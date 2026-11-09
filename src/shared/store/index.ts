import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import auth from './slices/authSlice';
import theme from './slices/themeSlice';
import lang from './slices/langSlice';
import ui from './slices/uiSlice';

const rootReducer = combineReducers({ auth, theme, lang, ui });

interface PersistedShape {
  auth?: { permissions?: unknown; user?: { role_id?: string } | null };
}

/**
 * Sube la versión cuando cambie la forma de un slice persistido.
 * Una sesión guardada con la forma anterior se descarta y el reducer vuelve a
 * su estado inicial: el usuario inicia sesión de nuevo en vez de romper la app.
 */
const PERSIST_VERSION = 2;

const persistedReducer = persistReducer(
  {
    key: 'root',
    storage,
    whitelist: ['auth', 'theme', 'lang'],
    version: PERSIST_VERSION,
    migrate: async (state) => {
      if (!state) return state;
      const persisted = state as PersistedShape;
      const auth = persisted.auth;
      const isStale = auth && (!Array.isArray(auth.permissions) || !auth.user?.role_id);
      if (!isStale) return state;
      // Se elimina la clave para que el reducer aporte su estado inicial.
      // Asignarle undefined la sobrescribiría y dejaría el slice sin forma.
      const { auth: _discarded, ...rest } = state as Record<string, unknown>;
      return rest as typeof state;
    },
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (gDM) =>
    gDM({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

let storeRef: typeof store | undefined;
export function setStoreRef(s: typeof store) {
  storeRef = s;
}
export function getStoreRef() {
  return storeRef;
}
