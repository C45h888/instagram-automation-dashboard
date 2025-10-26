// =====================================
// PERMISSION DEMO STORE
// Zustand store for permission demo state
// Follows existing authStore pattern
// =====================================

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * State properties that can be persisted
 */
interface PermissionDemoStateProperties {
  // Demo mode toggle
  demoMode: boolean;

  // Screencast mode (more detailed demo data)
  screencastMode: boolean;

  // Selected permission for viewing
  selectedPermission: string | null;

  // Demo data refresh
  lastRefresh: Date;

  // Meta reviewer notes
  reviewerNotes: boolean;

  // Permission states (simulated)
  permissionStates: {
    instagram_basic: 'granted' | 'requesting' | 'denied';
    instagram_manage_comments: 'granted' | 'requesting' | 'denied';
    instagram_content_publish: 'granted' | 'requesting' | 'denied';
    instagram_business_manage_messages: 'granted' | 'requesting' | 'denied';
  };
}

/**
 * Properties to persist to localStorage
 */
interface PersistedPermissionDemoState {
  demoMode: boolean;
  screencastMode: boolean;
  reviewerNotes: boolean;
}

/**
 * Action methods (non-serializable)
 */
interface PermissionDemoStateActions {
  setDemoMode: (enabled: boolean) => void;
  setScreencastMode: (enabled: boolean) => void;
  setSelectedPermission: (permission: string | null) => void;
  refreshDemoData: () => void;
  toggleReviewerNotes: () => void;
  updatePermissionState: (
    permission: keyof PermissionDemoStateProperties['permissionStates'],
    state: 'granted' | 'requesting' | 'denied'
  ) => void;
}

/**
 * Complete state type
 */
export type PermissionDemoState = PermissionDemoStateProperties & PermissionDemoStateActions;

// =====================================
// STORE IMPLEMENTATION
// =====================================

export const usePermissionDemoStore = create<PermissionDemoState>()(
  devtools(
    persist(
      (set) => ({
        // =====================================
        // INITIAL STATE
        // =====================================
        demoMode: true, // Start in demo mode for screencast
        screencastMode: false,
        selectedPermission: null,
        lastRefresh: new Date(),
        reviewerNotes: true, // Show by default for reviewers

        permissionStates: {
          instagram_basic: 'granted',
          instagram_manage_comments: 'granted',
          instagram_content_publish: 'granted',
          instagram_business_manage_messages: 'granted'
        },

        // =====================================
        // ACTIONS
        // =====================================

        setDemoMode: (enabled) => {
          set({ demoMode: enabled });
          console.log('📡 Demo mode:', enabled ? 'ON' : 'OFF');
        },

        setScreencastMode: (enabled) => {
          set({ screencastMode: enabled });
          console.log('🎬 Screencast mode:', enabled ? 'ON' : 'OFF');
        },

        setSelectedPermission: (permission) => {
          set({ selectedPermission: permission });
          console.log('🔍 Selected permission:', permission || 'none');
        },

        refreshDemoData: () => {
          set({ lastRefresh: new Date() });
          console.log('🔄 Demo data refreshed at:', new Date().toISOString());
        },

        toggleReviewerNotes: () => {
          set((state) => ({
            reviewerNotes: !state.reviewerNotes
          }));
        },

        updatePermissionState: (permission, state) => {
          set((prevState) => ({
            permissionStates: {
              ...prevState.permissionStates,
              [permission]: state
            }
          }));
          console.log(`✅ Permission ${permission} state:`, state);
        }
      }),
      {
        name: 'permission-demo-storage',
        storage: createJSONStorage(() => localStorage),
        /**
         * Explicit partialize for type-safe persistence
         */
        partialize: (state: PermissionDemoState): PersistedPermissionDemoState => ({
          demoMode: state.demoMode,
          screencastMode: state.screencastMode,
          reviewerNotes: state.reviewerNotes
          // Excluded: selectedPermission, lastRefresh, permissionStates (transient)
        })
      }
    ),
    { name: 'PermissionDemoStore' }
  )
);

// =====================================
// CONVENIENCE HOOKS
// =====================================

/**
 * Hook to check if demo mode is active
 */
export const useIsDemoMode = () => {
  const { demoMode } = usePermissionDemoStore();
  return demoMode;
};

/**
 * Hook to get permission state
 */
export const usePermissionState = (permission: keyof PermissionDemoStateProperties['permissionStates']) => {
  const { permissionStates } = usePermissionDemoStore();
  return permissionStates[permission];
};
