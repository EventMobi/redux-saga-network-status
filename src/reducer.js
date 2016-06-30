import { handleActions } from 'redux-actions';
import {
  BACKOFF,
  COUNT_DOWN,
  NAVIGATOR_OFFLINE,
  NAVIGATOR_ONLINE,
  PING_FAILURE,
  PING_PENDING,
  PING_SUCCESS,
} from './actionTypes';

/*
 * The network reducer tracks the state of connectivity to the network
 * and to the server
 */

const DEFAULT_STATE = {
  // True when we have been online at least once
  hasBeenOnline: false,
  // Whether we have pinged the server at least once
  hasDetectedNetworkStatus: false,
  // Whether the browser is connected to a network
  isNavigatorOnline: false,
  // Whether the server is reachable over the network
  isOnline: false,
  // Whether we are currently pinging the server
  isPinging: false,
  // Number of milliseconds until the next ping attempt
  msUntilNextPing: 0,
  // The most recent ping error
  pingError: null,
};

export default handleActions({
  [BACKOFF]: (state, { payload: msUntilNextPing }) => ({
    ...state,
    msUntilNextPing,
  }),
  [COUNT_DOWN]: (state, { payload: intervalLength }) => ({
    ...state,
    msUntilNextPing: state.msUntilNextPing - intervalLength,
  }),
  [NAVIGATOR_OFFLINE]: state => ({
    ...state,
    hasDetectedNetworkStatus: true,
    isNavigatorOnline: false,
    isOnline: false,
  }),
  [NAVIGATOR_ONLINE]: state => ({
    ...state,
    isNavigatorOnline: true,
  }),
  [PING_PENDING]: state => ({
    ...state,
    isPinging: true,
  }),
  [PING_FAILURE]: (state, { payload: pingError }) => ({
    ...state,
    hasDetectedNetworkStatus: true,
    isOnline: false,
    isPinging: false,
    pingError,
  }),
  [PING_SUCCESS]: state => ({
    ...state,
    hasBeenOnline: true,
    hasDetectedNetworkStatus: true,
    isOnline: true,
    isPinging: false,
  }),
}, DEFAULT_STATE);
