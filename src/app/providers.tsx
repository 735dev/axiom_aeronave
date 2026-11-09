import { ReactNode, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter } from 'react-router-dom';
import { store, persistor, setStoreRef } from '@/shared/store';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { DisplayMessage } from '@/shared/components/feedback/DisplayMessage';
import { ToasterRoot } from '@/shared/components/feedback/ToasterRoot';

export function Providers({ children }: { children: ReactNode }) {
  useState(() => {
    setStoreRef(store);
    return null;
  });

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <BrowserRouter>
            {children}
            <DisplayMessage />
            <ToasterRoot />
          </BrowserRouter>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
