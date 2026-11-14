export function createCatalogueNavigation({app,cards,workspace,change,search,filters,restoreFilters,renderCatalogue,openFromURL,closeModel,win=window}) {
  const catalogue=cards.closest('.st-catalogue');
  const {history,location}=win;
  const key='ncnPrintCatalogue';
  const initialRestoration=history.scrollRestoration;
  let returning=false;
  change.textContent='← Chọn mẫu khác';

  function currentEntry(){
    const entry=history.state?.[key];
    return entry?.path===location.pathname?entry:null;
  }

  function write(method,url,entry){
    history[method]({...history.state,[key]:{path:location.pathname,...entry}},'',url);
  }

  function select(url,source){
    if(!source||!workspace.hidden){
      history.replaceState(history.state,'',url);
      return;
    }
    const card=source.closest('[data-card-model]');
    const cardTop=card?.getBoundingClientRect().top;
    const choiceTop=source.getBoundingClientRect().top;
    const list={
      query:search.value,
      filters:filters(),
      y:win.scrollY,
      model:card?.dataset.cardModel,
      variant:source.dataset.variant,
      choiceTop,
      cardY:cardTop+win.scrollY
    };
    // Save the catalogue separately so browser traversal and the editor button
    // share the same history entry and restore the same filters and position.
    history.scrollRestoration='manual';
    write('replaceState',location.href,{list});
    write('pushState',url,{fromCatalogue:true});
    history.scrollRestoration='manual';
  }

  function showList(list,previousModel){
    if(!workspace.hidden)closeModel();
    workspace.hidden=true;
    catalogue.hidden=false;
    app.classList.remove('ncn-editing');
    if(list){
      search.value=list.query;
      restoreFilters(list.filters);
    }
    const id=list?.model||previousModel;
    renderCatalogue(id);
    if(!id)return;
    const card=[...cards.querySelectorAll('[data-card-model]')].find(node=>node.dataset.cardModel===id);
    if(!card){
      if(list)win.scrollTo({top:list.y,behavior:'instant'});
      return;
    }
    const button=list?.variant===undefined?card.querySelector('.st-card-preview'):
      [...card.querySelectorAll('[data-variant]')].find(node=>node.dataset.variant===list.variant);
    button?.focus({preventScroll:true});
    const space=parseFloat(win.getComputedStyle(app).getPropertyValue('--ncn-chrome-space'))||100;
    const top=card.getBoundingClientRect().top;
    const anchor=list&&Math.abs(top+win.scrollY-list.cardY)<4&&list.choiceTop>=space&&list.choiceTop<=win.innerHeight-32
      ?list.y:win.scrollY+top-space-12;
    win.scrollTo({top:Math.max(0,anchor),behavior:'instant'});
  }

  function sync(scroll){
    const url=new URL(location.href);
    const entry=currentEntry();
    if(!openFromURL(url,{scroll,fromCatalogue:entry?.fromCatalogue}))showList(entry?.list);
  }

  function onPopState(){
    returning=false;
    sync(true);
  }

  function onChangeModel(){
    if(returning)return;
    if(currentEntry()?.fromCatalogue){
      returning=true;
      history.back();
      return;
    }
    const url=new URL(location.href),previousModel=url.searchParams.get('mau');
    for(const param of ['mau','co','tieude'])url.searchParams.delete(param);
    history.replaceState(history.state,'',url);
    showList(null,previousModel);
  }

  change.addEventListener('click',onChangeModel);
  win.addEventListener('popstate',onPopState);
  return {
    select,
    start:()=>sync(false),
    destroy(){
      change.removeEventListener('click',onChangeModel);
      win.removeEventListener('popstate',onPopState);
      history.scrollRestoration=initialRestoration;
    }
  };
}
