import { createAction } from 'redux-actions';

import {
  BACKOFF,
  BACKOFF_COMPLETE,
  COUNT_DOWN,
  NAVIGATOR_OFFLINE,
  NAVIGATOR_ONLINE,
  PING,
  PING_CANCEL,
  PING_FAILURE,
  PING_PENDING,
  PING_SUCCESS,
  START_WATCH_NETWORK_STATUS,
} from './actionTypes';

export const backoff = createAction(BACKOFF);
export const backoffComplete = createAction(BACKOFF_COMPLETE);
export const countDown = createAction(COUNT_DOWN);
export const navigatorOffline = createAction(NAVIGATOR_OFFLINE);
export const navigatorOnline = createAction(NAVIGATOR_ONLINE);
export const ping = createAction(PING);
export const pingCancel = createAction(PING_CANCEL);
export const pingFailure = createAction(PING_FAILURE);
export const pingPending = createAction(PING_PENDING);
export const pingSuccess = createAction(PING_SUCCESS);
export const startWatchNetworkStatus = createAction(START_WATCH_NETWORK_STATUS);
