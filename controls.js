export function spacePress(previous,now,creative){return {last:now,toggle:creative&&previous>0&&now-previous<300};}
