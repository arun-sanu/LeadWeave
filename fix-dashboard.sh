sed -i 's/signal: unknown/signal: any/g' dashboard/src/contexts/LanMeshContext.tsx

sed -i "s/status: 'pending'/status: 'PENDING'/g" dashboard/src/pages/CampaignAnalytics.test.ts
sed -i "s/status: 'delivered'/status: 'DELIVERED'/g" dashboard/src/pages/CampaignAnalytics.test.ts
sed -i "s/status: 'failed'/status: 'FAILED'/g" dashboard/src/pages/CampaignAnalytics.test.ts

sed -i "s/stats?.responseRate/stats?.replyRate/g" dashboard/src/pages/CampaignAnalytics.tsx
sed -i "s/stats?.optOut/(stats as any)?.optOut/g" dashboard/src/pages/CampaignAnalytics.tsx
sed -i "s/lead.phone ||/ /g" dashboard/src/pages/CampaignAnalytics.tsx

sed -i "s/as Record<string, unknown>/as any/g" dashboard/src/pages/CampaignAnalytics.tsx

sed -i "s/'call' | 'whatsapp' | 'quote' | 'general'/'call' | 'whatsapp' | 'other' | 'followup'/g" dashboard/src/pages/NoticeBoard.tsx
sed -i "s/'low' | 'medium' | 'high' | 'urgent'/'low' | 'medium' | 'high'/g" dashboard/src/pages/NoticeBoard.tsx

sed -i "s/configSchema: {/configSchema: { type: 'object' as const, /g" dashboard/src/pages/Plugins.test.ts
sed -i "s/enabled: false,/ /g" dashboard/src/pages/Plugins.test.ts
sed -i "s/stars: 120,/ /g" dashboard/src/pages/Plugins.test.ts

