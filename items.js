import {BLOCKS} from './world.js?v=4';
export const ITEMS=BLOCKS;
export const MATERIALS=BLOCKS.map((b,i)=>b&&!b.hidden&&i!==7?i:0).filter(Boolean);
export const PLACEABLE=MATERIALS.filter(i=>!BLOCKS[i].item);
export const DEFAULT_BAR=[1,3,4,8,14,15,17,13,38];
export const RECIPES=[
 {name:'Дубовые доски',shape:[[4]],output:8,count:4},
 {name:'Берёзовые доски',shape:[[20]],output:41,count:4},
 {name:'Еловые доски',shape:[[22]],output:42,count:4},
 {name:'Палки',shape:[[8],[8]],output:40,count:4},
 {name:'Факелы',shape:[[12],[40]],output:13,count:4},
 {name:'Верстак',shape:[[8,8],[8,8]],output:29,count:1},
 {name:'Сундук',shape:[[8,8,8],[8,0,8],[8,8,8]],output:17,count:1},
 {name:'Печь',shape:[[3,3,3],[3,0,3],[3,3,3]],output:18,count:1},
 {name:'Дубовая дверь',shape:[[8,8],[8,8],[8,8]],output:15,count:3},
 {name:'Кровать',shape:[[43,43,43],[8,8,8]],output:19,count:1},
 {name:'Каменные кирпичи',shape:[[3,3],[3,3]],output:26,count:4},
 {name:'Забор',shape:[[40,8,40],[40,8,40]],output:34,count:3},
 {name:'Книжный шкаф',shape:[[8,8,8],[43,43,43],[8,8,8]],output:35,count:1},
 {name:'Фонарь',shape:[[39,39,39],[39,13,39],[39,39,39]],output:30,count:1},
 {name:'Путевой камень',shape:[[3,3,3],[3,39,3],[3,3,3]],output:38,count:1},
 {name:'Железный блок',shape:[[39,39,39],[39,39,39],[39,39,39]],output:28,count:1},
];
export function ingredients(recipe){const counts={};for(const row of recipe.shape)for(const b of row)if(b)counts[b]=(counts[b]||0)+1;return counts;}
export function canMake(inventory,recipe,creative=false){return creative||Object.entries(ingredients(recipe)).every(([b,n])=>(inventory[b]||0)>=n);}
export function gridFor(recipe){return Array.from({length:9},(_,i)=>recipe.shape[Math.floor(i/3)]?.[i%3]||0);}
export function matchRecipe(grid){
 const occupied=grid.map((b,i)=>b?i:-1).filter(i=>i>=0);if(!occupied.length)return null;
 const minX=Math.min(...occupied.map(i=>i%3)),minY=Math.min(...occupied.map(i=>Math.floor(i/3)));
 return RECIPES.find(recipe=>{
  if(minX+Math.max(...recipe.shape.map(row=>row.length))>3||minY+recipe.shape.length>3)return false;
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){const expected=y>=minY&&x>=minX?recipe.shape[y-minY]?.[x-minX]||0:0;if(grid[y*3+x]!==expected)return false;}
  return true;
 })||null;
}
export function fillRecipe(inventory,grid,recipe,creative=false){
 returnGrid(inventory,grid,creative);if(!canMake(inventory,recipe,creative))return false;
 grid.splice(0,9,...gridFor(recipe));if(!creative)for(const [b,n] of Object.entries(ingredients(recipe)))inventory[b]-=n;return true;
}
export function returnGrid(inventory,grid,creative=false){if(!creative)for(const b of grid)if(b)inventory[b]=(inventory[b]||0)+1;grid.fill(0);}
export function completeCraft(inventory,grid){const recipe=matchRecipe(grid);if(!recipe)return null;inventory[recipe.output]=(inventory[recipe.output]||0)+recipe.count;grid.fill(0);return recipe;}
