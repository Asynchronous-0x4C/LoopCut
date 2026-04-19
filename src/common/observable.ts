export class ObservableValue<T> {
  private _value: T;
  private listeners: Array<(prev: T, cur: T) => void> = new Array();

  constructor(value: T) {
    this._value = value;
  }

  get value() {
    return this._value;
  }
  set value(value: T) {
    this.listeners.forEach(l => l(this._value, value));
    this._value = value;
  }

  addListener(listener: (prev: T, cur: T) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (prev: T, cur: T) => void) {
    const i = this.listeners.indexOf(listener);
    this.listeners.splice(i, 1);
  }
}