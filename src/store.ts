import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";
import "reflect-metadata";

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

const restrictMetadataKey = Symbol("format");

export function Restrict(...params: unknown[]): any {
  const [ restrictedPermissions ] = params;
  return Reflect.metadata(restrictMetadataKey, restrictedPermissions);
}

const getRestrictions = (target: any, propertyKey: string) => {
  return Reflect.getMetadata(restrictMetadataKey, target, propertyKey);
};

export class StoreActionException extends Error {
  constructor(action: string, key: string) {
    super(`You do not have rights to ${action} key ${key}`);
  }
}

const readPermissions: Permission[] = ["rw", "r"];
const writePermissions: Permission[] = ["rw", "w"];
const pathSeparator = ":";

export class Store implements IStore {
  [key: string]: StoreValue | Function;
  defaultPolicy: Permission = "rw";

  allowedToDoAction(key: string, requiredPermissions: Permission[]) {
    const restrictions = getRestrictions(this, key);
    const permission = restrictions ?? this.defaultPolicy;
    return requiredPermissions.includes(permission);
  }

  allowedToRead(key: string): boolean {
    return this.allowedToDoAction(key, readPermissions);
  }

  allowedToWrite(key: string): boolean {
    return this.allowedToDoAction(key, writePermissions);
  }

  read(path: string): StoreResult {
    const [ key, ...nestedPathSegments ] = path.split(pathSeparator);

    if (!this.allowedToRead(key)) {
      throw new StoreActionException("read", key)
    }

    const nestedPath = nestedPathSegments.join(pathSeparator);
    if (nestedPath) {
      const target = this[key] ?? new Store();
      if (target instanceof Store) {
        return target.read(nestedPath);
      }
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
    const [ key, ...nestedPathSegments ] = path.split(pathSeparator);

    if (!this.allowedToWrite(key)) {
      throw new StoreActionException("write", key);
    }

    const nestedPath = nestedPathSegments.join(pathSeparator);
    if (nestedPath) {
      const isStore = !(this[key] instanceof Store);
      if (isStore) {
        this[key] = new Store();
      }
      const target = this[key];
      if (target instanceof Store) {
        return target.write(nestedPath, value);
      }
    }

    this[key] = value;
    return value;
  }

  writeEntries(entries: JSONObject): void {
    const getInternalPaths = (obj: JSONObject, prefix: string = ""): any => {
      return Object.keys(obj).map((key: string) => {
        const value = obj[key];
        if (value === null) {
          return this.write(`${prefix}${key}`, null);
        }
        if (typeof value === 'object') {
          return getInternalPaths(value as JSONObject, `${prefix}${key}${pathSeparator}`).flat();
        }
        return this.write(`${prefix}${key}`, obj[key]);
      });
    }
    getInternalPaths(entries);
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
