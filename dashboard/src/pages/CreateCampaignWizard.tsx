import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCampaignContext } from '../contexts/CampaignContext';
import { FileSpreadsheet, MessageSquare, Send, ArrowLeft } from 'lucide-react';
import './CreateCampaignWizard.css';
import './CampaignStudio.css';

export function CreateCampaignWizard() {
  useDocumentTitle('Create Campaign - LeadWeave');
  const navigate = useNavigate();
  const { campaignName, setCampaignName } = useCampaignContext();

  return (
    <div className="page-container campaign-studio-layout" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/campaigns')}
          className="wizard-back-btn"
          title="Return to Campaigns"
        >
          <ArrowLeft size={16} />
          <span>Back to Campaigns</span>
        </button>

        <div className="wizard-header-container">
          <p className="page-subtitle" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            New Broadcast Campaign
          </p>
          <input
            type="text"
            className="wizard-campaign-name-input"
            placeholder="Name your campaign... (e.g. Q4 Black Friday Promo)"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
        </div>
      </div>

      {/* WIZARD STEPS */}
      <div className="wizard-steps-nav">
        <NavLink to="/campaigns/new/data" className={({ isActive }) => `wizard-step ${isActive ? 'active' : ''}`}>
          <div className="step-icon"><FileSpreadsheet size={16} /></div>
          <span>1. Audience Data</span>
        </NavLink>

        <NavLink to="/campaigns/new/templates" className={({ isActive }) => `wizard-step ${isActive ? 'active' : ''}`}>
          <div className="step-icon"><MessageSquare size={16} /></div>
          <span>2. Message Template</span>
        </NavLink>
        
        <NavLink to="/campaigns/new/dispatch" className={({ isActive }) => `wizard-step ${isActive ? 'active' : ''}`}>
          <div className="step-icon"><Send size={16} /></div>
          <span>3. Dispatch Settings</span>
        </NavLink>
      </div>

      {/* CONTENT AREA */}
      <div className="wizard-content-area">
        <Outlet />
      </div>
    </div>
  );
}
