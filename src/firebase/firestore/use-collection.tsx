
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

export interface InternalQuery extends Query<DocumentData> {
  _query?: {
    path?: {
      canonicalString(): string;
      toString(): string;
      isEmpty(): boolean;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // CRITICAL GUARD: Prevent queries if the reference is null or undefined.
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Safety check: ensure we aren't querying the root documents collection accidentally
    let path = "";
    let isCollectionGroup = false;
    try {
        // Detect collection groups - they usually have no direct path property on the Query object
        // but have an internal empty path. 
        if ('path' in memoizedTargetRefOrQuery) {
            path = (memoizedTargetRefOrQuery as any).path;
        } else {
            const internal = memoizedTargetRefOrQuery as unknown as InternalQuery;
            const qPath = internal._query?.path;
            path = qPath?.canonicalString() || "";
            // If it's a query and the path is empty, it's likely a collection group.
            if (path === "" || !qPath) {
                isCollectionGroup = true;
            }
        }
    } catch (e) {
        path = "unknown";
    }

    // Block root queries that aren't collection groups. 
    if (!isCollectionGroup && (path === "" || path === "/" || path === "unknown")) {
        setData(null);
        setIsLoading(false);
        setError(null);
        return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        snapshot.docs.forEach(doc => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path || 'collectionGroup',
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);
        // Emit but don't crash the UI via throw.
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);
  
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('Query was not properly memoized using useMemoFirebase');
  }
  
  return { data, isLoading, error };
}
