// Shim — wraps the package useActor with the project's createActor so
// existing hooks can call useActor() without arguments.
import { useActor as _useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useActor() {
  return _useActor(createActor);
}
