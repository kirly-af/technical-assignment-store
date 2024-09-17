import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
  | JSONObject
  | JSONArray
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export function Restrict(...params: unknown[]): any {
}

interface Storage { [key: string]: StoreValue }

export class Store implements IStore {
  _entries: Storage = {};
  defaultPolicy: Permission = "rw";

  allowedToRead(key: string): boolean {
    return true;
  }

  allowedToWrite(key: string): boolean {
    return true;
  }

  read(path: string): StoreResult {
    const value: StoreValue = this._entries[path];
    const isPrimitive = typeof value !== "object"
    const isNull = value === null;
    const isCallback = typeof value === "function";

    if (isCallback) {
      return value();
    }

    if (isNull) {
      return null;
    }

    if (isPrimitive) {
      return value;
    }

    return true;
  }

  write(path: string, value: StoreValue): StoreValue {
    this._entries[path] = value;
    return value;
  }

  writeEntries(entries: JSONObject): void {
    throw new Error("Method not implemented.");
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
