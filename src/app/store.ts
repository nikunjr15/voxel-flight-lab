/**
 * The viewer's UI state, and a tiny typed emitter around it. The chrome writes
 * to it when the visitor clicks; the app reads it to move the camera. Neither
 * side holds a reference to the other.
 */

export type ModeId = 'overview' | 'plan' | 'cockpit' | 'engines' | 'weapons' | 'xray';
export type ToggleId = 'orbit' | 'thrust' | 'sound';

export interface ViewerState {
  mode: ModeId;
  orbit: boolean;
  thrust: boolean;
  sound: boolean;
  /** Index of the annotation card shown when only one fits. */
  note: number;
}

type Listener<S, K extends keyof S> = (value: S[K], state: S) => void;

export class Store<S extends object> {
  private state: S;
  private readonly listeners = new Map<keyof S, Set<Listener<S, keyof S>>>();

  constructor(initial: S) {
    this.state = { ...initial };
  }

  get<K extends keyof S>(key: K): S[K] {
    return this.state[key];
  }

  snapshot(): Readonly<S> {
    return this.state;
  }

  /** Writes a value and notifies listeners, unless nothing changed. */
  set<K extends keyof S>(key: K, value: S[K]): void {
    if (Object.is(this.state[key], value)) return;
    this.state = { ...this.state, [key]: value };
    for (const fn of this.listeners.get(key) ?? []) fn(value, this.state);
  }

  /** Subscribes to one key. Returns an unsubscribe function. */
  on<K extends keyof S>(key: K, fn: Listener<S, K>): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(fn as Listener<S, keyof S>);
    return () => set.delete(fn as Listener<S, keyof S>);
  }
}

export const createViewerStore = (): Store<ViewerState> =>
  new Store<ViewerState>({ mode: 'overview', orbit: false, thrust: false, sound: false, note: 0 });
