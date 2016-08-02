import {
  BACKOFF,
  COUNT_DOWN,
  NAVIGATOR_OFFLINE,
  NAVIGATOR_ONLINE,
  PING_FAILURE,
  PING_PENDING,
  PING_SUCCESS,
} from '../actionTypes';
import networkReducer from '../reducer';

jest.unmock('../actionTypes');
jest.unmock('../reducer');

const DEFAULT_STATE = {
  hasBeenOnline: false,
  hasDetectedNetworkStatus: false,
  isNavigatorOnline: false,
  isOnline: false,
  isPinging: false,
  msUntilNextPing: 0,
  pingError: null,
};

describe('network reducer', () => {
  it('has the correct default state', () => {
    const state = networkReducer(undefined, {
      type: 'OTHER',
    });
    expect(state).toEqual(DEFAULT_STATE);
  });

  it('resets `msUntilNextPing` upon BACKOFF', () => {
    const state = networkReducer(undefined, {
      type: BACKOFF,
      payload: 5000,
    });
    expect(state.msUntilNextPing).toBe(5000);
  });

  it('counts down `msUntilNextPing` upon COUNT_DOWN', () => {
    const state = networkReducer({
      ...DEFAULT_STATE,
      msUntilNextPing: 5000,
    }, {
      type: COUNT_DOWN,
      payload: 2300,
    });
    expect(state.msUntilNextPing).toBe(2700);
  });

  it(
    'sets `hasDetectedNetworkStatus = true`, ' +
    '`isNavigatorOnline = isOnline = false` upon NAVIGATOR_OFFLINE',
    () => {
      const state = networkReducer({
        ...DEFAULT_STATE,
        hasDetectedNetworkStatus: false,
        isNavigatorOnline: true,
        isOnline: true,
      }, {
        type: NAVIGATOR_OFFLINE,
      });
      expect(state.hasDetectedNetworkStatus).toBe(true);
      expect(state.isNavigatorOnline).toBe(false);
      expect(state.isOnline).toBe(false);
    }
  );

  it('sets `isNavigatorOnline = true` upon NAVIGATOR_ONLINE', () => {
    const state = networkReducer({
      ...DEFAULT_STATE,
      isNavigatorOnline: false,
    }, {
      type: NAVIGATOR_ONLINE,
    });
    expect(state.isNavigatorOnline).toBe(true);
  });

  it('sets `isPinging = true` upon PING_PENDING', () => {
    const state = networkReducer({
      ...DEFAULT_STATE,
      isPinging: false,
    }, {
      type: PING_PENDING,
    });
    expect(state.isPinging).toBe(true);
  });

  it(
    'sets `hasDetectedNetworkStatus`, `isOnline`, `isPinging`, and `pingError` upon PING_FAILURE',
    () => {
      const state = networkReducer(undefined, {
        type: PING_FAILURE,
        error: true,
        payload: new Error('uh oh'),
      });
      expect(state.hasDetectedNetworkStatus).toBe(true);
      expect(state.isOnline).toBe(false);
      expect(state.isPinging).toBe(false);
      expect(state.pingError.message).toEqual('uh oh');
    }
  );

  it(
    'sets `hasBeenOnline`, `hasDetectedNetworkStatus`, ' +
    '`isOnline`, and `isPinging` upon PING_SUCCESS',
    () => {
      const state = networkReducer(undefined, {
        type: PING_SUCCESS,
      });
      expect(state.hasBeenOnline).toBe(true);
      expect(state.hasDetectedNetworkStatus).toBe(true);
      expect(state.isOnline).toBe(true);
      expect(state.isPinging).toBe(false);
    }
  );
});
