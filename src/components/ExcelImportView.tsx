import React from 'react';
import { SettingsView } from './SettingsView';
import { Item } from '../types';

interface ExcelImportViewProps {
  currentItemsCount: number;
  onImportItems: (newItems: Item[], mode: 'replace' | 'append') => void;
  onResetToDefault: () => void;
  onNavigateToCatalog: () => void;
  allCurrentItems: Item[];
}

export const ExcelImportView: React.FC<ExcelImportViewProps> = (props) => {
  return <SettingsView {...props} initialSubTab="import" />;
};
