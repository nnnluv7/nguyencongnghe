export const CAMPAIGN_LEVEL_COUNT=100;
export const LEGACY_LEVEL_COUNT=200;

// Keep the first five stages familiar and reach the old finale in 100 stages.
export function classicDifficultyLevel(level){
  if(level<=5)return level;
  return 5+Math.round((Math.min(level,CAMPAIGN_LEVEL_COUNT)-5)*(LEGACY_LEVEL_COUNT-5)/(CAMPAIGN_LEVEL_COUNT-5));
}
