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
  // const [ restrictedPermissions ] = params;
  // return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  //   target.permissions = target.permissions ?? {};
  //   target.permissions[propertyKey] = restrictedPermissions ?? "none";
  // };
}

interface StorageEntry {
  value: StoreValue,
  permission?: Permission
}

interface StoragePermissions {
  [key: string]: Permission
}

export class StoreActionException extends Error {
  constructor(action: string, key: string) {
    super(`You do not have rights to ${action} key ${key}`);
  }
}

const readPermissions: Permission[] = ["rw", "r"];
const writePermissions: Permission[] = ["rw", "w"];

export class Store implements IStore {
  [key: string]: StoreValue | Function;
  permissions: StoragePermissions = {};
  defaultPolicy: Permission = "rw";

  getEntry(path: string) {
    return this[path];
  }

  allowedToDoAction(key: string, permissionsForAction: Permission[]) {
    const permission = this.permissions[key] ?? this.defaultPolicy;
    return permissionsForAction.includes(permission);
  }

  allowedToRead(key: string): boolean {
    return this.allowedToDoAction(key, readPermissions);
  }

  allowedToWrite(key: string): boolean {
    return this.allowedToDoAction(key, writePermissions);
  }

  read(path: string): StoreResult {
    if (!this.allowedToRead(path)) {
      throw new StoreActionException("read", path)
    }
    const value = this[path];
    const isPrimitive = typeof value !== "object"
    const isNull = value === null;
    const isFactory = typeof value === "function";

    if (isFactory) {
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
    if (!this.allowedToWrite(path)) {
      throw new StoreActionException("write", path)
    }
    this[path] = value;
    return value;
  }

  writeEntries(entries: JSONObject): void {
    throw new Error("Method not implemented.");
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
