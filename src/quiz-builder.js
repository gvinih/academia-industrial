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
  let currentSubject=null;
  async function load(selectedSubject=null){
    currentSubject=selectedSubject;
    if(!selectedSubject){
      shell(`<section class="profile-heading"><div class="eyebrow">ADMINISTRAÇÃO</div><h1>Gerenciador de quizzes</h1><p class="muted">Selecione uma matéria para visualizar, criar e administrar seus quizzes.</p></section>
      <section class="quiz-manager-subject-grid">${subjects.map(s=>`<button type="button" class="quiz-manager-subject-card" data-subject="${s.id}"><span class="eyebrow">MATÉRIA</span><strong>${esc(s.name)}</strong><span>Gerenciar quizzes <b aria-hidden="true">→</b></span></button>`).join('')}</section>`);
      document.querySelectorAll('[data-subject]').forEach(b=>b.addEventListener('click',()=>load(subjects.find(s=>s.id===b.dataset.subject))));
      return;
    }
    shell(`<button class="back-button" id="quiz-subject-back">← Todas as matérias</button>
    <section class="profile-heading"><div class="eyebrow">GERENCIAMENTO POR MATÉRIA</div><h1>${esc(selectedSubject.name)}</h1><p class="muted">Crie e gerencie somente os quizzes desta matéria.</p></section>
    <section class="panel quiz-builder-panel"><div class="section-title"><h2>Novo quiz · ${esc(selectedSubject.name)}</h2><span class="muted">Banco de questões independente</span></div>
    <form id="new-managed-quiz" class="quiz-builder-form">
      <input type="hidden" name="subject_id" value="${selectedSubject.id}">
      <label class="field">Formato do quiz<select name="content_type" id="new-quiz-type"><option value="interactive" selected>Interativo</option><option value="exam">Prova</option></select></label>
      <label class="field">Título do quiz<input name="title" maxlength="120" placeholder="Ex.: Encontro 2 — Seiton" required></label>
      <label class="field quiz-builder-wide">Descrição<textarea name="description" rows="2" maxlength="500" placeholder="Descreva os assuntos abordados neste quiz."></textarea></label>
      <label class="field">Perguntas por tentativa<select name="questions_per_attempt"><option value="5">5 perguntas</option><option value="10" selected>10 perguntas</option><option value="15">15 perguntas</option><option value="20">20 perguntas</option><option value="0">Usar todas as perguntas</option></select><small class="muted">Cadastre um banco maior de perguntas. A cada tentativa, o sistema sorteará a quantidade escolhida, sem repetir perguntas dentro da mesma tentativa.</small></label>
      <button class="btn btn-primary" type="submit">Criar quiz</button>
    </form></section>
    <section class="panel quiz-builder-panel"><div class="section-title"><h2>Quizzes de ${esc(selectedSubject.name)}</h2></div><div id="managed-quiz-list"><div class="skeleton">Carregando quizzes…</div></div></section>`);
    document.querySelector('#quiz-subject-back').addEventListener('click',()=>load());
    document.querySelector('#new-managed-quiz').addEventListener('submit',async e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget);
      const payload={subject_id:selectedSubject.id,title:fd.get('title').trim(),description:fd.get('description').trim(),questions_per_attempt:Number(fd.get('questions_per_attempt')),content_type:fd.get('content_type'),html_path:null,is_published:false};
      const {error}=await supabase.from('quiz_catalog').insert(payload);
      if(error){toast(error.message,true);return;}
      toast(payload.content_type==='interactive'?'Quiz interativo criado como rascunho. Cadastre as perguntas para publicar.':'Prova criada como rascunho. Cadastre o banco de perguntas para publicar.');
      await load(currentSubject);
    });
    await renderList(selectedSubject);
  }
  async function renderList(selectedSubject){
    const target=document.querySelector('#managed-quiz-list');
    const {data,error}=await supabase.from('quiz_catalog').select('id,subject_id,title,description,questions_per_attempt,is_published,created_at,content_type,html_path').eq('subject_id',selectedSubject.id).is('html_path',null).order('created_at',{ascending:true});
    if(error){target.innerHTML='<p class="muted">Não foi possível carregar os quizzes.</p>';toast(error.message,true);return;}
    if(!data?.length){target.innerHTML='<div class="empty-state">Nenhum quiz criado. Use o formulário acima para começar.</div>';return;}
    target.innerHTML=data.length?`<div class="managed-subject-count">${data.length} quiz(es) cadastrado(s)</div><div class="managed-quiz-list">${data.map(q=>`<article class="managed-quiz-card" data-quiz="${q.id}">
          <div class="managed-quiz-summary"><div><span class="eyebrow">${q.content_type==='interactive'?'INTERATIVO':'PROVA'}</span><h3>${esc(q.title)}</h3><p>${esc(q.description||'Sem descrição')}</p></div><span class="managed-status ${q.is_published?'is-published':''}">${q.is_published?'Publicado':'Rascunho'}</span></div>
          <div class="managed-quiz-actions"><span class="muted small">${q.content_type==='interactive'?'Padrão visual da matéria':q.questions_per_attempt===0?'Todas as perguntas':q.questions_per_attempt+' perguntas por tentativa'}</span><button class="btn btn-light btn-small" data-edit-title="${q.id}">Alterar título</button><button class="btn btn-light btn-small" data-manage="${q.id}">Gerenciar perguntas</button><button class="btn btn-light btn-small" data-publish="${q.id}" data-state="${q.is_published}">${q.is_published?'Retirar publicação':'Publicar'}</button><button class="btn btn-danger btn-small" data-remove="${q.id}">Remover quiz</button></div><div class="managed-question-area" id="questions-${q.id}" hidden></div>
        </article>`).join('')}</div>
      </div>`:'<div class="empty-state">Ainda não há quizzes cadastrados para esta matéria.</div>';
    target.querySelectorAll('[data-edit-title]').forEach(b=>b.addEventListener('click',async()=>{
      const q=data.find(item=>item.id===b.dataset.editTitle);if(!q)return;
      const nextTitle=prompt('Digite o novo título do quiz:',q.title);
      if(nextTitle===null)return;
      const title=nextTitle.trim();
      if(!title){toast('O título não pode ficar vazio.',true);return;}
      if(title.length>120){toast('O título deve ter no máximo 120 caracteres.',true);return;}
      const {error}=await supabase.from('quiz_catalog').update({title,updated_at:new Date().toISOString()}).eq('id',q.id);
      if(error){toast(error.message,true);return;}
      toast('Título atualizado. O card da matéria também exibirá o novo título.');await load(selectedSubject);
    }));
    target.querySelectorAll('[data-manage]').forEach(b=>b.addEventListener('click',()=>manageQuestions(data.find(q=>q.id===b.dataset.manage))));
    target.querySelectorAll('[data-publish]').forEach(b=>b.addEventListener('click',()=>togglePublish(data.find(q=>q.id===b.dataset.publish))));
    target.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeQuiz(data.find(q=>q.id===b.dataset.remove))));
  }
  async function togglePublish(q){
    if(!q.html_path){
      const {count,error:countError}=await supabase.from('quiz_questions').select('id',{count:'exact',head:true}).eq('quiz_id',q.id).eq('is_active',true);
      if(countError){toast(countError.message,true);return;}
      const needed=q.questions_per_attempt;
      if(!q.is_published&&(count===0||(needed>0&&count<needed))){toast('Cadastre pelo menos '+needed+' perguntas ativas antes de publicar.',true);return;}
    }
    const {error}=await supabase.from('quiz_catalog').update({is_published:!q.is_published,updated_at:new Date().toISOString()}).eq('id',q.id);
    if(error){toast(error.message,true);return;}toast(q.is_published?'Quiz retirado da publicação.':'Quiz publicado para os alunos.');await load(selectedSubject);
  }
  async function removeQuiz(q){
    if(!confirm('Excluir o quiz "'+q.title+'" e todas as perguntas vinculadas? O histórico de tentativas dos alunos será preservado.'))return;
    const {error}=await supabase.from('quiz_catalog').delete().eq('id',q.id);
    if(error){toast(error.message,true);return;}toast('Quiz excluído.');await load(selectedSubject);
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
  const {data:pool,error}=await supabase.from('quiz_questions').select('id,question_text,options,correct_option,explanation').eq('quiz_id',quiz.id).eq('is_active',true);
  if(error){box.innerHTML='<p class="muted">Não foi possível carregar este quiz.</p>';return;}
  const amount=quiz.questions_per_attempt===0?pool.length:quiz.questions_per_attempt;
  if(!pool?.length||pool.length<amount){box.innerHTML='<div class="empty-state">Este quiz ainda não possui perguntas suficientes.</div>';return;}
  const questions=shuffle(pool).slice(0,amount).map(q=>({...q,shuffledOptions:shuffle(q.options.map((text,index)=>({text,index})))}));
  const started=Date.now();
  box.innerHTML=`<div class="managed-quiz-player ${theme} mode-exam">
    <header class="managed-player-head"><div><span class="managed-player-tag">PROVA</span><h2 class="managed-exam-title">${esc(quiz.title)}</h2><p class="managed-exam-description">${esc(quiz.description||'Leia cada questão com atenção e selecione uma alternativa.')}</p></div><span class="managed-player-count">${questions.length} questões</span></header>
    <form id="managed-exam-form" class="managed-exam-form">
      <div class="managed-exam-instructions">Responda todas as questões e, quando terminar, clique em <strong>Enviar respostas</strong>. A correção será exibida somente após o envio.</div>
      ${questions.map((q,i)=>`<fieldset class="managed-exam-question" data-question-id="${q.id}">
        <legend><span class="managed-exam-number">QUESTÃO ${i+1}</span><span class="managed-exam-statement">${esc(q.question_text)}</span></legend>
        <div class="managed-exam-options">${q.shuffledOptions.map((o,j)=>`<label class="managed-exam-option"><input type="radio" name="question-${q.id}" value="${o.index}" required><span class="managed-exam-letter">${String.fromCharCode(65+j)}</span><span>${esc(o.text)}</span></label>`).join('')}</div>
        <div class="managed-exam-correction" hidden></div>
      </fieldset>`).join('')}
      <div class="managed-exam-submit"><span class="managed-exam-progress">${questions.length} questões · Uma única submissão</span><button class="btn btn-primary" type="submit">Enviar respostas</button></div>
    </form>
    <section class="managed-exam-final" hidden></section>
  </div>`;
  const form=box.querySelector('#managed-exam-form');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    if(!form.reportValidity())return;
    submit.disabled=true;submit.textContent='Corrigindo respostas…';
    const fd=new FormData(form);
    const answers=questions.map(q=>({question_id:q.id,selected_option:Number(fd.get('question-'+q.id))}));
    const {data,error}=await supabase.rpc('submit_managed_quiz',{p_quiz_id:quiz.id,p_answers:answers});
    if(error){toast(error.message||'Não foi possível registrar a prova.',true);submit.disabled=false;submit.textContent='Enviar respostas';return;}
    const result=Array.isArray(data)?data[0]:data;
    const answerMap=new Map(answers.map(a=>[a.question_id,a.selected_option]));
    questions.forEach(q=>{
      const field=form.querySelector('[data-question-id="'+q.id+'"]');
      const selected=answerMap.get(q.id),isCorrect=selected===q.correct_option;
      field.classList.add(isCorrect?'is-correct':'is-wrong');
      field.querySelectorAll('input').forEach(input=>{
        input.disabled=true;
        const label=input.closest('.managed-exam-option');
        const optionIndex=Number(input.value);
        if(optionIndex===q.correct_option)label.classList.add('is-answer-correct');
        if(optionIndex===selected&&!isCorrect)label.classList.add('is-answer-wrong');
      });
      const correction=field.querySelector('.managed-exam-correction');
      correction.hidden=false;
      correction.innerHTML='<strong>'+(isCorrect?'✓ Resposta correta':'✕ Resposta incorreta')+'</strong><p><b>Alternativa correta:</b> '+esc(q.options[q.correct_option])+'</p>'+(q.explanation?'<p>'+esc(q.explanation)+'</p>':'');
    });
    submit.remove();
    form.querySelector('.managed-exam-instructions').textContent='Prova corrigida. Confira abaixo o resultado de cada questão.';
    const final=box.querySelector('.managed-exam-final');
    const percent=Math.round((result.score/(result.total_questions||questions.length))*100);
    final.hidden=false;
    final.innerHTML=`<div class="managed-result-card"><span class="managed-player-tag">RESULTADO FINAL</span><h2>${result.score}/${result.total_questions||questions.length} acertos · ${percent}%</h2><p>${result.is_first_attempt?'Você recebeu '+result.points_awarded+' pontos no ranking.':'Esta tentativa foi registrada; os pontos deste quiz já foram contabilizados na primeira participação.'}</p><p class="muted">Tempo de prova: ${Math.floor((Date.now()-started)/1000)}s</p><button class="btn btn-primary" type="button" id="managed-finish">Concluir</button></div>`;
    final.querySelector('#managed-finish').addEventListener('click',onFinish);
  });
}
