import { useContext } from 'react';
import { AppContext, type AppToestand } from './AppProvider';

/** De gedeelde toestand. Gooit als hij buiten de provider gebruikt wordt. */
export const useApp = (): AppToestand => {
  const waarde = useContext(AppContext);
  if (!waarde) throw new Error('useApp buiten AppProvider gebruikt');
  return waarde;
};
