import fetch from 'isomorphic-fetch';
import range from 'lodash/fp/range';
import {
  delay,
  takeLatest,
} from 'redux-saga';
import {
  call,
  cancel,
  cancelled,
  fork,
  join,
  put,
  race,
  take,
} from 'redux-saga/effects';

import {
  backoff,
  backoffComplete,
  countDown,
  navigatorOffline,
  navigatorOnline,
  ping,
  pingCancel,
  pingFailure,
  pingPending,
  pingSuccess,
} from './actions';
import {
  BACKOFF,
  BACKOFF_COMPLETE,
  NAVIGATOR_OFFLINE,
  NAVIGATOR_ONLINE,
  PING,
  PING_CANCEL,
  PING_FAILURE,
  PING_SUCCESS,
  START_WATCH_NETWORK_STATUS,
} from './actionTypes';
import {
  once,
} from './utils';

export function* watchWindowOnline() {
  while (true) {
    yield call(once, window, 'online');
    yield put(navigatorOnline());
  }
}

export function* watchWindowOffline() {
  while (true) {
    yield call(once, window, 'offline');
    yield put(navigatorOffline());
  }
}

/**
 * redux-saga task which continuously dispatches NAVIGATOR_ONLINE and NAVIGATOR_OFFLINE
 * actions as the browser's network status changes. An initial NAVIGATOR_ONLINE / NAVIGATOR_OFFLINE
 * action is dispatched based on `window.navigator.onLine` to establish the initial state.
 * @param {Object} navigator A `window.navigator` instance
 */
export function* watchNavigatorStatus(navigator) {
  if (navigator.onLine) {
    yield put(navigatorOnline());
  } else {
    yield put(navigatorOffline());
  }
  yield fork(watchWindowOnline);
  yield fork(watchWindowOffline);
}

/**
 * redux-saga task which performs a GET request to the given URL and dispatches
 * PING_SUCCESS or PING_FAILURE depending on the response.
 * @param {object} action The PING or PING_CANCEL action
 */
export function* handlePing({ type, payload: pingUrl }) {
  if (type === PING_CANCEL) {
    return;
  }

  yield put(pingPending());
  // Ensure ping takes at least 1 second
  const delayTask = yield fork(delay, 1000);
  try {
    const { ping: response } = yield race({
      ping: call(fetch, pingUrl),
      // Timeout if ping takes longer than 5 seconds
      timeout: call(delay, 5000),
    });
    if (response) {
      if (response.ok) {
        // Ping succeeded; indicate success immediately
        yield put(pingSuccess());
      } else {
        // Ping response is 4xx / 5xx; wait until delay completes, then indicate failure
        yield join(delayTask);
        yield put(pingFailure());
      }
    } else {
      // Timed out
      yield put(pingFailure());
    }
  } catch (error) {
    // Ping failed; wait until delay completes
    yield join(delayTask);
    yield put(pingFailure());
  } finally {
    if (yield cancelled()) {
      yield put(pingFailure());
    }
  }
}

/**
 * redux-saga task which pings the given URL whenever a PING action is dispatched,
 * or cancels the ping in progress when a PING_CANCEL action is dispatched.
 * @param  {string} pingUrl URL which will be pinged
 */
export function* watchPing() {
  yield* takeLatest([PING, PING_CANCEL], handlePing);
}

/**
 * redux-saga task which will dispatch COUNT_DOWN actions at regular intervals until
 * the given time has elapsed, upon which a BACKOFF_COMPLETE action is dispatched.
 * @param {object} action
 *   A BACKOFF action
 * @param {number} action.payload
 *   Total number of milliseconds during which COUNT_DOWN actions will be dispatched.
 */
export function* handleBackoff({ payload: ms }) {
  const intervalLength = 1000;  // count down by one second at a time
  const intervalCount = Math.floor(ms / intervalLength);
  for (const i of range(0, intervalCount)) {  // eslint-disable-line no-unused-vars,no-restricted-syntax,max-len
    yield put(countDown(intervalLength));
    yield call(delay, intervalLength);
  }
  if (ms % intervalLength > 0) {
    // Count down by the remaining milliseconds if any
    yield put(countDown(ms % intervalLength));
    yield call(delay, ms % intervalLength);
  }
  yield put(backoffComplete());
}

/**
 * redux-saga task which starts the backoff sequence whenever a BACKOFF action is dispatched.
 */
export function* watchBackoff() {
  yield* takeLatest(BACKOFF, handleBackoff);
}

/**
 * Get the next value in a fibonacci sequence based on the previous and current values
 * and a randomisation factor.
 * @param  {number} randomizationFactor
 *   A number >= 0 and <= 1 which controls the amount by which the next value will be increased
 *   by a random number.
 *   A value of 1 means the next value will be multiplied by (1 + Math.random()).
 *   A value of 0.5 means the next value will be multiplied by (1 + 0.5 * Math.random()).
 *   A value of 0 means the next value will be multiplied by 1 (i.e. no randomization)
 *
 * @param  {number} previous The previous value in the sequence
 * @param  {number} current  The current value in the sequence
 * @return {number}          The next value in the sequence
 */
export function getNextFibonacciValue(randomizationFactor, previous, current) {
  const next = previous + current;
  return next + (next * randomizationFactor * Math.random());
}

/**
 * redux-saga task which will continuously ping the given URL, and upon successful ping,
 * will dispatch an ONLINE action and complete.
 * In order to reduce network congestion when many users reconnect simultaneously,
 * we use a fibonacci backoff sequence to delay subsequent pings: if a ping fails, the next ping
 * is delayed at increasing time intervals, plus a randomisation factor in an effort to
 * evenly distribute reconnect attempts across time.
 * @param {string} pingUrl
 *   URL which will be pinged
 * @param {object} options
 *   Options
 * @param {number} options.randomizationFactor
 *   Fibonacci randomization factor (see `getNextFibonacciValue`)
 * @param {number} initialDelay
 *   Initial number of milliseconds to delay the next ping
 * @param {number} maxDelay
 *   Maximum number of milliseconds to delay the next ping
 */
export function* fibonacciPoll(pingUrl, { randomizationFactor, initialDelay, maxDelay }) {
  let previousDelay = 0;
  let currentDelay = initialDelay;

  try {
    yield put(ping(pingUrl));
    while (true) {
      const action = yield take([PING_SUCCESS, PING_FAILURE]);
      if (action.type === PING_SUCCESS) {
        return;
      }
      // Ping failed; backoff
      yield put(backoff(currentDelay));
      // Wait for a manual ping, or until the backoff has completed.
      const winner = yield race({
        backoffComplete: take(BACKOFF_COMPLETE),
        ping: take(PING),
      });
      if (winner.backoffComplete) {
        // Delay has elapsed; trigger another ping
        yield put(ping(pingUrl));
      }
      const nextDelay = getNextFibonacciValue(randomizationFactor, previousDelay, currentDelay);
      previousDelay = currentDelay;
      currentDelay = Math.min(nextDelay, maxDelay);
    }
  } finally {
    if (yield cancelled()) {
      yield put(pingCancel());
    }
  }
}

/**
 * redux-saga task which continuously query the browser's network status and the connectivity
 * to the server, dispatching actions to the network reducer when events occur.
 */
export default function* watchNetworkStatus() {
  const { payload: pingUrl } = yield take(START_WATCH_NETWORK_STATUS);
  yield fork(watchBackoff);
  yield fork(watchPing);
  yield fork(watchNavigatorStatus, window.navigator);
  while (true) {
    // Begin polling when navigator is online
    yield take(NAVIGATOR_ONLINE);
    const pollTask = yield fork(fibonacciPoll, pingUrl, {
      randomizationFactor: 0.5,
      initialDelay: 500,
      maxDelay: 10000,
    });
    // Stop polling when navigator is offline
    yield take(NAVIGATOR_OFFLINE);
    yield cancel(pollTask);
  }
}
