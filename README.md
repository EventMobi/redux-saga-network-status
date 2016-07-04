# redux-saga-network-status [![CircleCI][circleci-badge]][circleci] [![npm][npm-badge]][npm]

Network status detection with server ping and backoff for [redux-saga][].

Monitors network status using a combination of [NavigatorOnLine.onLine](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine), [Online and offline events](https://developer.mozilla.org/en/docs/Online_and_offline_events), and pinging a server (with an HTTP GET request). Server pings are retried using a fibonacci [backoff interval](https://en.wikipedia.org/wiki/Exponential_backoff) with a randomization factor to prevent network congestion.

### Installation
```shell
npm install redux-saga-network-status
```

### Usage
redux-saga-network-status exports its saga by default. Start it as part of your root saga, e.g.
```js
// sagas.js
import watchNetworkStatus from 'redux-saga-network-status';

export default function* rootSaga() {
  yield fork(watchNetworkStatus);
  // ... more sagas
}
```

And connect the reducer to your root reducer:
```js
// reducers.js
import { combineReducers } from 'redux';
import { reducer as network } from 'redux-saga-network-status';

export default combineReducers({
  network,
  // ... more reducers
});
```

```js
// main.js
import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';

import reducer from './reducers';
import rootSaga from './sagas';

const sagaMiddleware = createSagaMiddleware();
const store = createStore(
  reducer,
  applyMiddleware(sagaMiddleware),
);

sagaMiddleware.run(rootSaga);
```

Then dispatch the `startWatchNetworkStatus` action to begin monitoring network status using the provided ping URL:
```jsx
import { actions as networkActions } from 'redux-saga-network-status';

class AppContainer extends Component {
  componentWillMount() {
    const { startWatchNetworkStatus } = this.props;
    startWatchNetworkStatus('/api/ping');
  }

  render() { /* ... */ }
}

export default connect(null, {
  startWatchNetworkStatus: networkActions.startWatchNetworkStatus,
})(AppContainer);
```

##### Reducer state
The `network` reducer we connected above will provide the following state in your store:
```js
// True when we have been online at least once
state.network.hasBeenOnline;
// Whether we have pinged the server at least once
state.network.hasDetectedNetworkStatus;
// Whether the browser is connected to a network
state.network.isNavigatorOnline;
// Whether the server is reachable over the network
state.network.isOnline;
// Whether we are currently pinging the server
state.network.isPinging;
// Number of milliseconds until the next ping attempt
state.network.msUntilNextPing;
// The most recent ping error
state.network.pingError;
```

[circleci]: https://circleci.com/gh/EventMobi/redux-saga-network-status
[circleci-badge]: https://circleci.com/gh/EventMobi/redux-saga-network-status.svg?style=svg&circle-token=d193707e16cb7e5184e89a552f27008850bccc3d
[npm-badge]: https://img.shields.io/npm/v/redux-saga-network-status.svg
[npm]: https://www.npmjs.com/package/redux-saga-network-status
[redux-saga]: http://yelouafi.github.io/redux-saga/
