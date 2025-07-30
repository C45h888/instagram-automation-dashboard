@@ .. @@
 import { create } from 'zustand';
+import { persist } from 'zustand/middleware';

 interface User {
   id: string;
@@ .. @@
   updateUser: (user: Partial<User>) => void;
 }

-export const useAuthStore = create<AuthState>((set) => ({
-  user: null,
-  token: null,
-  isAuthenticated: false,
-  permissions: [],
-  login: (user, token) => set({ user, token, isAuthenticated: true, permissions: user.permissions }),
-  logout: () => set({ user: null, token: null, isAuthenticated: false, permissions: [] }),
-  refreshToken: (token) => set((state) => ({ ...state, token })),
-  updateUser: (user) => set((state) => ({ user: { ...state.user, ...user } as User })),
-}));
+export const useAuthStore = create<AuthState>()(
+  persist(
+    (set) => ({
+      user: null,
+      token: null,
+      isAuthenticated: false,
+      permissions: [],
+      login: (user, token) => set({ user, token, isAuthenticated: true, permissions: user.permissions }),
+      logout: () => set({ user: null, token: null, isAuthenticated: false, permissions: [] }),
+      refreshToken: (token) => set((state) => ({ ...state, token })),
+      updateUser: (user) => set((state) => ({ user: { ...state.user, ...user } as User })),
+    }),
+    {
+      name: 'instagram-auth',
+      partialize: (state) => ({
+        user: state.user,
+        token: state.token,
+        isAuthenticated: state.isAuthenticated,
+        permissions: state.permissions,
+      }),
+    }
+  )
+);