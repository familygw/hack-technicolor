import { Observable, of, switchMap, tap } from "rxjs";

export function startWithTap<T>(callback: () => void) {
  return (source: Observable<T>) =>
    of({}).pipe(tap(callback), switchMap((o) => source));
}
