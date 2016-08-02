/**
 * Create a promise which resolves
 * once a particular event is dispatched by the given DOM EventTarget.
 * @param  {EventTarget}  target An EventTarget
 * @param  {string}       type   The type of event
 * @return {Promise<any>}        Resolves with the event once it's dispatched
 */
export function once(target, type) {
  return new Promise(resolve => {
    const listener = e => {
      target.removeEventListener(type, listener);
      resolve(e);
    };
    target.addEventListener(type, listener);
  });
}
