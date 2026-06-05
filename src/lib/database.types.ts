/**
 * Database type definitions. In a real project these are generated with:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 * Kept hand-written here and checked into git so the client is fully typed
 * without requiring a live Supabase connection at build time.
 */
import type { TravelData } from '@/domain/schema';

// NOTE: must be a `type`, not an `interface`. Supabase's `GenericTable`
// constraint requires `Row extends Record<string, unknown>`, and interfaces
// (unlike type aliases) have no implicit index signature — using an interface
// here silently degrades every query to `never`.
export type TravelRecordRow = {
  id: string;
  user_id: string;
  data: TravelData;
  is_public: boolean;
  share_slug: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FriendLinkRow = {
  id: string;
  user_id: string;
  slug: string;
  label: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      travel_records: {
        Row: TravelRecordRow;
        Insert: {
          user_id?: string;
          data: TravelData;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Update: {
          data?: TravelData;
          is_public?: boolean;
          share_slug?: string | null;
        };
        Relationships: [];
      };
      friend_links: {
        Row: FriendLinkRow;
        Insert: {
          user_id?: string;
          slug: string;
          label?: string | null;
        };
        Update: {
          label?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_shared_travel: {
        Args: { p_slug: string };
        Returns: TravelData | null;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
