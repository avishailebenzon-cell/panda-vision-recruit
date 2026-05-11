import React, { createContext, useContext, useState, useEffect } from 'react';

// Default agent configurations
const DEFAULT_AGENTS = {
  carmit: {
    id: 'carmit',
    defaultName: 'כרמית',
    roleTitle: 'מנהלת הגיוס',
    description: 'מנצחת על כל העובדים במערך הגיוס',
    avatar: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=100&h=100&fit=crop&crop=faces&facepad=2'
  },
  naama: {
    id: 'naama',
    defaultName: 'נעמה',
    roleTitle: 'מועמדים למשרות',
    description: 'התאמת מועמדים למשרות',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face'
  },
  roee: {
    id: 'roee',
    defaultName: 'רועי',
    roleTitle: 'משרות למועמדים',
    description: 'מציאת משרות למועמדים',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face'
  },
  rotem: {
    id: 'rotem',
    defaultName: 'טל',
    roleTitle: 'תקשורת מועמדים',
    description: 'תקשורת מועמדים בוואטסאפ',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face'
  },
  yael: {
    id: 'yael',
    defaultName: 'יעל',
    roleTitle: 'ציידת המועמדים',
    description: 'אחראית להביא מועמדים לחברה',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face'
  },
  noa: {
    id: 'noa',
    defaultName: 'נועה',
    roleTitle: 'משרות',
    description: 'ניהול משרות פתוחות ודרישות',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face'
  },
  elad: {
    id: 'elad',
    defaultName: 'אלעד',
    roleTitle: 'לקוחות',
    description: 'מנהל הלקוחות, אחראי על ניהול לקוחות ויחסי עסקים',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
  },
  hila: {
    id: 'hila',
    defaultName: 'הילה',
    roleTitle: 'הפצת משרות',
    description: 'קופירייטרית, אחראית על הפצת משרות לעובדי החברה',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
  },
  raviv: {
    id: 'raviv',
    defaultName: 'רביב',
    roleTitle: 'ניהול מערכת',
    description: 'מנהל המערכת, אחראי על הגדרת נהלים ושיטות הגיוס',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'
  },
  shiri: {
    id: 'shiri',
    defaultName: 'שירי',
    roleTitle: 'קשרי עובדים',
    description: 'מנהלת קשרי עובדים, מטפלת בפניות עובדים ותחזוקת רשימה',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face'
  },
  inbar: {
    id: 'inbar',
    defaultName: 'ענבר',
    roleTitle: 'תוכנית משא"ן',
    description: 'מנהלת תכנון שנתי של פעילויות ואירועים לעובדים',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face'
  }
};

const AgentNamesContext = createContext(null);

export function AgentNamesProvider({ children }) {
  const [agentNames, setAgentNames] = useState(DEFAULT_AGENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgentDisplayConfigs();
  }, []);

  const loadAgentDisplayConfigs = async () => {
    try {
      const { AgentDisplayConfig } = await import('@/entities/AgentDisplayConfig');
      const configs = await AgentDisplayConfig.list();
      
      const updatedAgents = { ...DEFAULT_AGENTS };
      
      configs.forEach(config => {
        if (updatedAgents[config.agent_id]) {
          updatedAgents[config.agent_id] = {
            ...updatedAgents[config.agent_id],
            displayName: config.display_name || updatedAgents[config.agent_id].defaultName,
            roleTitle: config.role_title || updatedAgents[config.agent_id].roleTitle,
            description: config.description || updatedAgents[config.agent_id].description,
            avatar: config.avatar_url || updatedAgents[config.agent_id].avatar
          };
        }
      });

      setAgentNames(updatedAgents);
    } catch (error) {
      console.error('Error loading agent display configs:', error);
    }
    setLoading(false);
  };

  const getAgentName = (agentId) => {
    const agent = agentNames[agentId];
    return agent?.displayName || agent?.defaultName || agentId;
  };

  const getAgentInfo = (agentId) => {
    const agent = agentNames[agentId];
    if (!agent) return null;
    
    return {
      name: agent.displayName || agent.defaultName,
      roleTitle: agent.roleTitle,
      description: agent.description,
      avatar: agent.avatar,
      defaultName: agent.defaultName
    };
  };

  const refreshAgentNames = () => {
    loadAgentDisplayConfigs();
  };

  return (
    <AgentNamesContext.Provider value={{ 
      agentNames, 
      getAgentName, 
      getAgentInfo, 
      refreshAgentNames,
      loading,
      DEFAULT_AGENTS 
    }}>
      {children}
    </AgentNamesContext.Provider>
  );
}

export function useAgentNames() {
  const context = useContext(AgentNamesContext);
  if (!context) {
    // Return default fallback when used outside provider
    return {
      agentNames: DEFAULT_AGENTS,
      getAgentName: (id) => DEFAULT_AGENTS[id]?.defaultName || id,
      getAgentInfo: (id) => DEFAULT_AGENTS[id] ? {
        name: DEFAULT_AGENTS[id].defaultName,
        roleTitle: DEFAULT_AGENTS[id].roleTitle,
        description: DEFAULT_AGENTS[id].description,
        avatar: DEFAULT_AGENTS[id].avatar,
        defaultName: DEFAULT_AGENTS[id].defaultName
      } : null,
      refreshAgentNames: () => {},
      loading: false,
      DEFAULT_AGENTS
    };
  }
  return context;
}

export { DEFAULT_AGENTS };