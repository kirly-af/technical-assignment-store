import { JSONArray, JSONObject, JSONPrimitive, JSONValue } from "./json-types";
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
    const nestedPath = nestedPathSegments.join(pathSeparator);

    if (!this.allowedToRead(key)) {
      throw new StoreActionException("read", key)
    }

    const value = this[key];
    const isPrimitive = typeof value !== "object"
    const isNull = value === null;
    const isFactory = typeof value === "function";
    const isStore = value instanceof Store;

    if (isFactory) {
      const store = value();

      if (nestedPath) {
        return store.read(nestedPath);
      }

      return store;
    }

    if (isNull) {
      return null;
    }

    if (isPrimitive) {
      return value;
    }

    if (nestedPath) {
      const target = this[key] ?? new Store();
      if (target instanceof Store) {
        return target.read(nestedPath);
      }
    }

    if (isStore) {
      return value;
    }

    return true;
  }

  write(path: string, value: StoreValue): StoreValue {
    const [ key, ...nestedPathSegments ] = path.split(pathSeparator);

    const nestedPath = nestedPathSegments.join(pathSeparator);
    if (nestedPath) {
      const isStore = this[key] instanceof Store;
      if (!isStore) {
        this[key] = new Store();
      }

      const target = this[key];
      if (target instanceof Store) {
        if (!this.allowedToRead(key)) {
          throw new StoreActionException("read", key);
        }
        return target.write(nestedPath, value);
      }
    }

    if (typeof value === "object") {
      const isStore = this[key] instanceof Store;
      if (!isStore) {
        this[key] = new Store();
      }

      const target = this[key];
      if (target instanceof Store) {
        target.writeEntries(value as JSONObject);
        return target;
      }
    }

    if (!this.allowedToWrite(key)) {
      throw new StoreActionException("write", key);
    }
    this[key] = value;
    return value;
  }

  writeEntries(entries: JSONObject): void {
    const writeNestedEntries = (obj: JSONObject, pathPrefix: string = ""): any => {
      return Object.keys(obj).map((key: string) => {
        const value = obj[key];
        const path = `${pathPrefix}${key}`;
        if (value === null) {
          return this.write(path, null);
        }
        if (typeof value === 'object') {
          return writeNestedEntries(value as JSONObject, `${path}${pathSeparator}`).flat();
        }
        return this.write(path, obj[key]);
      });
    }
    writeNestedEntries(entries);
  }

  entries(): JSONObject {
    return Object.keys(this).reduce((accumulator: JSONObject, key: string) => {
      accumulator = accumulator ?? {};
      const isJsonValue = typeof this[key] !== "number" && typeof this[key] !== "undefined";
      if (isJsonValue && this.allowedToRead(key)) {
        accumulator[key] = this[key] as JSONValue;
      }
      return accumulator;
    }, {});
  }
}
