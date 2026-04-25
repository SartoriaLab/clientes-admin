export interface UseRestaurantData<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  save: (newContent: T) => Promise<void>;
  reload: () => Promise<void>;
}

export function useRestaurantData<T = unknown>(slug: string, docId: string): UseRestaurantData<T>;
