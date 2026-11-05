import './style.css';

const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = items => {
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
};
const themeFor = id => ({'5s':'theme-5s','lubrificacao':'theme-lube','pneumatica':'theme-pneumatic','eletrica':'theme-electric'}[id]||'theme-default');

export async function openQuizManager({supabase,subjects,onBack}) {
  const app=document.querySelector('#app');
  const shell=content=>{
    app.innerHTML=`<header class="topbar"><a class="brand" href="#"><img class="brand-logo" src="/academia-industrial/progeral-logo.svg" alt=""><span>Academia Industrial<small>Aprender • Praticar • Evoluir</small></span></a><div id="header-actions"><button class="btn btn-light btn-small" id="quiz-manager-back">Voltar</button></div></header><main>${content}</main><footer>Academia Industrial · Treinamento e desenvolvimento</footer><div id="toast" class="toast"></div>`;
    document.querySelector('#quiz-manager-back').addEventListener('click',onBack);
  };
  const toast=(msg,error=false)=>{const el=document.querySelector('#toast');if(el){el.textContent=msg;el.className='toast show '+(error?'error':'');}};
  async function load(){
    shell(`<section class="profile-heading"><div class="eyebrow">ADMINISTRAÇÃO</div><h1>Gerenciador de quizzes</h1><p class="muted">Crie avaliações, cadastre perguntas e publique cada quiz para os alunos.</p></section>
    <section class="panel quiz-builder-panel"><div class="section-title"><h2>Novo quiz</h2><span class="muted">Banco de questões independente</span></div>
    <form id="new-managed-quiz" class="quiz-builder-form">
      <label class="field">Matéria<select name="subject_id" required>${subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Formato do quiz<select name="content_type" id="new-quiz-type"><option value="generated" selected>Prova (perguntas e alternativas)</option><option value="html">Interativo (HTML personalizado)</option></select></label>
      <label class="field">Título do quiz<input name="title" maxlength="120" placeholder="Ex.: Encontro 2 — Seiton" required></label>
      <label class="field quiz-builder-wide">Descrição<textarea name="description" rows="2" maxlength="500" placeholder="Descreva os assuntos abordados neste quiz."></textarea></label>
      <label class="field" id="new-quiz-amount-field">Perguntas por tentativa<select name="questions_per_attempt"><option value="5">5 perguntas</option><option value="10" selected>10 perguntas</option><option value="15">15 perguntas</option><option value="20">20 perguntas</option><option value="0">Usar todas as perguntas</option></select></label>
      <label class="field quiz-builder-wide" id="new-quiz-html-field" hidden>Arquivo HTML (caminho dentro de public/)<input name="html_path" maxlength="180" placeholder="Ex.: quiz-novo-encontro.html"><small class="muted">O arquivo precisa estar publicado na pasta public/ do GitHub. O HTML mantém seu próprio visual e funcionamento.</small></label>
      <button class="btn btn-primary" type="submit">Criar quiz</button>
    </form></section>
    <section class="panel quiz-builder-panel"><div class="section-title"><h2>Quizzes cadastrados</h2></div><div id="managed-quiz-list"><div class="skeleton">Carregando quizzes…</div></div></section>`);
    const quizType=document.querySelector('#new-quiz-type');
    const htmlField=document.querySelector('#new-quiz-html-field');
    const amountField=document.querySelector('#new-quiz-amount-field');
    const syncQuizType=()=>{
      const isHtml=quizType.value==='html';
      htmlField.hidden=!isHtml;amountField.hidden=isHtml;
      htmlField.querySelector('input').required=isHtml;
    };
    quizType.addEventListener('change',syncQuizType);syncQuizType();
    document.querySelector('#new-managed-quiz').addEventListener('submit',async e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget),isHtml=fd.get('content_type')==='html';
      const htmlPath=String(fd.get('html_path')||'').trim().replace(/^\/+/, '');
      if(isHtml&&!htmlPath){toast('Informe o caminho do arquivo HTML.',true);return;}
      if(isHtml){
        const {data:existing,error:lookupError}=await supabase.from('quiz_catalog').select('id').eq('html_path',htmlPath).maybeSingle();
        if(lookupError){toast(lookupError.message,true);return;}
        if(existing){toast('Esse arquivo HTML já está cadastrado no catálogo.',true);return;}
      }
      const payload={subject_id:fd.get('subject_id'),title:fd.get('title').trim(),description:fd.get('description').trim(),questions_per_attempt:isHtml?0:Number(fd.get('questions_per_attempt')),content_type:isHtml?'html':'generated',html_path:isHtml?htmlPath:null,is_published:false};
      const {error}=await supabase.from('quiz_catalog').insert(payload);
      if(error){toast(error.message,true);return;}
      toast(isHtml?'Quiz HTML cadastrado como rascunho.':'Prova criada como rascunho. Agora adicione as perguntas.');
      await load();
    });
    await renderList();
  }
  async function renderList(){
    const target=document.querySelector('#managed-quiz-list');
    const {data,error}=await supabase.from('quiz_catalog').select('id,subject_id,title,description,questions_per_attempt,is_published,created_at,content_type,html_path').order('created_at',{ascending:false});
    if(error){target.innerHTML='<p class="muted">Não foi possível carregar os quizzes.</p>';toast(error.message,true);return;}
    if(!data?.length){target.innerHTML='<div class="empty-state">Nenhum quiz criado. Use o formulário acima para começar.</div>';return;}
    target.innerHTML='<div class="managed-quiz-list">'+data.map(q=>`<article class="managed-quiz-card" data-quiz="${q.id}">
      <div class="managed-quiz-summary"><div><span class="eyebrow">${esc(subjects.find(s=>s.id===q.subject_id)?.name||q.subject_id)}</span><h3>${esc(q.title)}</h3><p>${esc(q.description||'Sem descrição')}</p></div><span class="managed-status ${q.is_published?'is-published':''}">${q.is_published?'Publicado':'Rascunho'}</span></div>
      <div class="managed-quiz-actions"><span class="muted small">${q.content_type==='html'?'HTML interativo personalizado':q.questions_per_attempt===0?'Todas as perguntas (configuração dinâmica)':q.questions_per_attempt+' perguntas por tentativa'}</span>${q.content_type==='html'?'<button class="btn btn-light btn-small" data-preview-html="'+q.id+'">Visualizar HTML</button>':'<button class="btn btn-light btn-small" data-manage="'+q.id+'">Gerenciar perguntas</button>'}<button class="btn btn-light btn-small" data-publish="${q.id}" data-state="${q.is_published}">${q.is_published?'Retirar publicação':'Publicar'}</button><button class="btn btn-danger btn-small" data-remove="${q.id}">Remover do catálogo</button></div><div class="managed-question-area" id="questions-${q.id}" hidden></div>
    </article>`).join('')+'</div>';
    target.querySelectorAll('[data-manage]').forEach(b=>b.addEventListener('click',()=>manageQuestions(data.find(q=>q.id===b.dataset.manage))));
    target.querySelectorAll('[data-preview-html]').forEach(b=>b.addEventListener('click',()=>{
      const q=data.find(x=>x.id===b.dataset.previewHtml);
      if(q?.html_path)window.open(import.meta.env.BASE_URL+q.html_path,'_blank','noopener');
    }));
    target.querySelectorAll('[data-publish]').forEach(b=>b.addEventListener('click',()=>togglePublish(data.find(q=>q.id===b.dataset.publish))));
    target.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeQuiz(data.find(q=>q.id===b.dataset.remove))));
  }
  async function togglePublish(q){
    if(q.content_type!=='html'){
      const {count,error:countError}=await supabase.from('quiz_questions').select('id',{count:'exact',head:true}).eq('quiz_id',q.id).eq('is_active',true);
      if(countError){toast(countError.message,true);return;}
      const needed=q.questions_per_attempt;
      if(!q.is_published&&(count===0||(needed>0&&count<needed))){toast('Cadastre pelo menos '+needed+' perguntas ativas antes de publicar.',true);return;}
    }
    const {error}=await supabase.from('quiz_catalog').update({is_published:!q.is_published,updated_at:new Date().toISOString()}).eq('id',q.id);
    if(error){toast(error.message,true);return;}toast(q.is_published?'Quiz retirado da publicação.':'Quiz publicado para os alunos.');await load();
  }
  async function removeQuiz(q){
    if(!confirm(q.content_type==='html'?'Remover "'+q.title+'" do catálogo? O arquivo HTML continuará no GitHub.':'Excluir o quiz "'+q.title+'" e todas as perguntas vinculadas? O histórico de tentativas dos alunos será preservado.'))return;
    const {error}=await supabase.from('quiz_catalog').delete().eq('id',q.id);
    if(error){toast(error.message,true);return;}toast('Quiz excluído.');await load();
  }
  async function manageQuestions(q){
    const area=document.querySelector('#questions-'+q.id);area.hidden=false;area.innerHTML='<div class="skeleton">Carregando perguntas…</div>';
    const {data,error}=await supabase.from('quiz_questions').select('id,question_text,options,correct_option,explanation,is_active,sort_order').eq('quiz_id',q.id).order('sort_order').order('created_at');
    if(error){area.innerHTML='<p class="muted">Falha ao carregar perguntas.</p>';toast(error.message,true);return;}
    area.innerHTML=`<div class="quiz-question-admin"><div class="section-title"><h4>Perguntas cadastradas (${data.length})</h4><span class="muted">A ordem das alternativas será embaralhada no quiz.</span></div>
      <div class="managed-question-list">${data.length?data.map((p,i)=>`<div class="managed-question-row"><div><strong>${i+1}. ${esc(p.question_text)}</strong><small>${p.is_active?'Ativa':'Inativa'} · ${p.options.length} alternativas</small></div><button class="btn btn-light btn-small" data-edit-question="${p.id}">Editar</button><button class="btn btn-danger btn-small" data-delete-question="${p.id}">Excluir</button></div>`).join(''):'<p class="muted">Ainda não há perguntas neste quiz.</p>'}</div>
      <form class="managed-question-form" id="question-form-${q.id}">
        <h4 id="question-form-title-${q.id}">Adicionar pergunta</h4><input type="hidden" name="question_id">
        <label class="field">Enunciado<textarea name="question_text" rows="3" maxlength="1200" required placeholder="Digite a pergunta"></textarea></label>
        <div class="managed-options-grid">${[0,1,2,3].map(i=>`<label class="field"><span>Alternativa ${String.fromCharCode(65+i)}</span><input name="option_${i}" maxlength="500" required placeholder="Digite a alternativa"><span class="correct-choice"><input type="radio" name="correct_option" value="${i}" ${i===0?'checked':''}> Resposta correta</span></label>`).join('')}</div>
        <label class="field">Explicação da resposta (opcional)<textarea name="explanation" rows="2" maxlength="1000" placeholder="Explique por que essa alternativa está correta."></textarea></label>
        <div class="managed-form-actions"><button class="btn btn-primary" type="submit">Salvar pergunta</button><button class="btn btn-light" type="button" data-cancel-edit="${q.id}">Limpar formulário</button></div>
      </form></div>`;
    const form=area.querySelector('form');
    form.addEventListener('submit',async e=>{
      e.preventDefault();const fd=new FormData(form),id=String(fd.get('question_id')||'');
      const options=[0,1,2,3].map(i=>String(fd.get('option_'+i)||'').trim());
      if(options.some(x=>!x)){toast('Preencha as quatro alternativas.',true);return;}
      const payload={subject_id:q.subject_id,quiz_id:q.id,question_text:String(fd.get('question_text')).trim(),options,correct_option:Number(fd.get('correct_option')),explanation:String(fd.get('explanation')||'').trim(),is_active:true,sort_order:data.length?Math.max(...data.map(x=>x.sort_order||0))+1:1};
      const {error}=id?await supabase.from('quiz_questions').update(payload).eq('id',id):await supabase.from('quiz_questions').insert(payload);
      if(error){toast(error.message,true);return;}toast('Pergunta salva.');await manageQuestions(q);
    });
    area.querySelectorAll('[data-edit-question]').forEach(b=>b.addEventListener('click',()=>{
      const p=data.find(x=>x.id===b.dataset.editQuestion);if(!p)return;
      form.elements.question_id.value=p.id;form.elements.question_text.value=p.question_text;
      [0,1,2,3].forEach(i=>form.elements['option_'+i].value=p.options[i]||'');
      form.querySelector('input[name="correct_option"][value="'+p.correct_option+'"]').checked=true;
      form.elements.explanation.value=p.explanation||'';
      area.querySelector('#question-form-title-'+q.id).textContent='Editar pergunta';
      form.scrollIntoView({behavior:'smooth',block:'center'});
    }));
    area.querySelectorAll('[data-delete-question]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Excluir esta pergunta?'))return;
      const {error}=await supabase.from('quiz_questions').delete().eq('id',b.dataset.deleteQuestion);
      if(error){toast(error.message,true);return;}toast('Pergunta excluída.');await manageQuestions(q);
    }));
    area.querySelector('[data-cancel-edit]').addEventListener('click',()=>manageQuestions(q));
  }
  await load();
}

export async function renderManagedQuiz({supabase,quiz,box,onFinish}) {
  const theme=themeFor(quiz.subject_id);
  box.innerHTML='<p class="muted">Carregando perguntas…</p>';
  const {data:pool,error}=await supabase.from('quiz_questions').select('id,question_text,options').eq('quiz_id',quiz.id).eq('is_active',true);
  if(error){box.innerHTML='<p class="muted">Não foi possível carregar este quiz.</p>';return;}
  const amount=quiz.questions_per_attempt===0?pool.length:quiz.questions_per_attempt;
  if(pool.length<amount||!pool.length){box.innerHTML='<div class="empty-state">Este quiz ainda não possui perguntas suficientes.</div>';return;}
  const questions=shuffle(pool).slice(0,amount).map(q=>({...q,shuffledOptions:shuffle(q.options.map((text,index)=>({text,index})))}));
  let current=0,answers={},seconds=35,timer=null,locked=false,started=Date.now();
  box.innerHTML=`<div class="managed-quiz-player ${theme}"><header class="managed-player-head"><span class="managed-player-tag">${esc(quiz.title)}</span><span class="managed-player-count" id="managed-count"></span></header><div class="managed-player-progress"><i id="managed-progress"></i></div><div class="managed-player-card"><div class="managed-player-meta"><span id="managed-question-number"></span><strong id="managed-timer">35s</strong></div><h2 id="managed-question-text"></h2><div class="managed-player-options" id="managed-options"></div><div class="managed-player-feedback" id="managed-feedback" hidden></div><div class="managed-player-controls"><button class="btn btn-light" id="managed-back" disabled>Anterior</button><button class="btn btn-primary" id="managed-next" disabled>Próxima</button></div></div></div>`;
  const $=id=>box.querySelector('#'+id);
  const finish=async()=>{
    clearInterval(timer);$('managed-next').disabled=true;
    const payload=questions.map(q=>({question_id:q.id,selected_option:answers[q.id]?.index??-1}));
    const {data,error}=await supabase.rpc('submit_managed_quiz',{p_quiz_id:quiz.id,p_answers:payload});
    if(error){box.insertAdjacentHTML('beforeend','<p class="inline-message">'+esc(error.message)+'</p>');return;}
    const result=Array.isArray(data)?data[0]:data;
    box.innerHTML=`<div class="managed-quiz-player ${theme}"><div class="managed-result-card"><span class="managed-player-tag">RESULTADO FINAL</span><h2>${result.score}/${result.total_questions} acertos</h2><p>${result.is_first_attempt?'Você recebeu '+result.points_awarded+' pontos no ranking.':'Esta tentativa foi registrada, mas os pontos deste quiz já foram contabilizados na primeira participação.'}</p><p class="muted">Pontuação da primeira tentativa: ${result.points_awarded} pontos · Tempo: ${Math.floor((Date.now()-started)/1000)}s</p><button class="btn btn-primary" id="managed-finish">Concluir</button></div></div>`;
    $('managed-finish').addEventListener('click',onFinish);
  };
  const show=()=>{
    locked=false;seconds=35;const q=questions[current];
    $('managed-count').textContent=(current+1)+' de '+questions.length;
    $('managed-question-number').textContent='PERGUNTA '+(current+1);
    $('managed-question-text').textContent=q.question_text;
    $('managed-timer').textContent=seconds+'s';$('managed-progress').style.width=((current+1)/questions.length*100)+'%';
    $('managed-options').innerHTML=q.shuffledOptions.map(o=>`<button type="button" class="managed-option ${answers[q.id]?.index===o.index?'is-selected':''}" data-option="${o.index}"><span>${String.fromCharCode(65+q.shuffledOptions.indexOf(o))}</span>${esc(o.text)}</button>`).join('');
    $('managed-feedback').hidden=true;$('managed-next').disabled=answers[q.id]===undefined;$('managed-next').textContent=current===questions.length-1?'Finalizar quiz':'Próxima';
    $('managed-back').disabled=current===0;
    $('managed-options').querySelectorAll('[data-option]').forEach(b=>b.addEventListener('click',()=>{if(locked)return;answers[q.id]={index:Number(b.dataset.option)};$('managed-options').querySelectorAll('.managed-option').forEach(x=>x.classList.toggle('is-selected',x===b));$('managed-next').disabled=false;}));
    $('managed-back').onclick=()=>{if(current>0){clearInterval(timer);current--;show();}};
    $('managed-next').onclick=()=>{if(!answers[q.id]||locked)return;clearInterval(timer);if(current===questions.length-1)finish();else{current++;show();}};
    clearInterval(timer);timer=setInterval(()=>{seconds--;$('managed-timer').textContent=seconds+'s';if(seconds<=0){clearInterval(timer);locked=true;if(current===questions.length-1)finish();else{current++;show();}}},1000);
  };
  show();
}
