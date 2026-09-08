import { createContext, useContext, useState, type ReactNode } from 'react';

// Common types
export interface SpreadsheetRow {
  id: string;
  phone: string;
  [key: string]: string;
}

interface CampaignContextType {
  // Spreadsheet State
  campaignName: string;
  setCampaignName: React.Dispatch<React.SetStateAction<string>>;

  // Composer State
  selectedSessions: string[];
  setSelectedSessions: React.Dispatch<React.SetStateAction<string[]>>;
  messageTemplate: string;
  setMessageTemplate: React.Dispatch<React.SetStateAction<string>>;

  // Dispatch Settings State
  enforceSafeTimezone: boolean;
  setEnforceSafeTimezone: React.Dispatch<React.SetStateAction<boolean>>;
  minDelay: number;
  setMinDelay: React.Dispatch<React.SetStateAction<number>>;
  maxDelay: number;
  setMaxDelay: React.Dispatch<React.SetStateAction<number>>;
  simulateTyping: boolean;
  setSimulateTyping: React.Dispatch<React.SetStateAction<boolean>>;
  scheduleType: 'now' | 'later';
  setScheduleType: React.Dispatch<React.SetStateAction<'now' | 'later'>>;
  scheduleDateTime: string;
  setScheduleDateTime: React.Dispatch<React.SetStateAction<string>>;

  // Batch Monitors
  activeBatches: { sessionId: string; batchId: string }[];
  setActiveBatches: React.Dispatch<React.SetStateAction<{ sessionId: string; batchId: string }[]>>;
  batchStatusMap: Record<string, { status: string; progress: { total: number; sent: number; failed: number } }>;
  setBatchStatusMap: React.Dispatch<React.SetStateAction<Record<string, { status: string; progress: { total: number; sent: number; failed: number } }>>>;
  isLaunching: boolean;
  setIsLaunching: React.Dispatch<React.SetStateAction<boolean>>;
  isCancelling: boolean;
  setIsCancelling: React.Dispatch<React.SetStateAction<boolean>>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  // Spreadsheet State
  const [campaignName, setCampaignName] = useState<string>('');

  // Composer State
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState(
    '{Hi|Hello|Hey} {{Name}}! 👋 {Your order #{{OrderNumber}} has been confirmed|We have received your order #{{OrderNumber}}}. Total amount: {{Amount}}. {Thank you for choosing LeadWeave!|Have a wonderful day!}'
  );

  // Timezone Guard & Pacing & Scheduling State
  const [enforceSafeTimezone, setEnforceSafeTimezone] = useState(false);
  const [minDelay, setMinDelay] = useState(6);
  const [maxDelay, setMaxDelay] = useState(14);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Active batches
  const [activeBatches, setActiveBatches] = useState<{ sessionId: string; batchId: string }[]>([]);
  const [batchStatusMap, setBatchStatusMap] = useState<Record<string, { status: string; progress: { total: number; sent: number; failed: number } }>>({});
  const [isLaunching, setIsLaunching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  return (
    <CampaignContext.Provider
      value={{
        campaignName, setCampaignName,
        selectedSessions, setSelectedSessions,
        messageTemplate, setMessageTemplate,
        enforceSafeTimezone, setEnforceSafeTimezone,
        minDelay, setMinDelay,
        maxDelay, setMaxDelay,
        simulateTyping, setSimulateTyping,
        scheduleType, setScheduleType,
        scheduleDateTime, setScheduleDateTime,
        activeBatches, setActiveBatches,
        batchStatusMap, setBatchStatusMap,
        isLaunching, setIsLaunching,
        isCancelling, setIsCancelling,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaignContext() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaignContext must be used within a CampaignProvider');
  }
  return context;
}
