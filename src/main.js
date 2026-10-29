import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from './config.js';
import './style.css';

const configured = SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('COLE_AQUI') && !SUPABASE_ANON_KEY.includes('COLE_AQUI');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const app = document.querySelector('#app');
const subjects = [
  { id:'5s', name:'5S', description:'Organização, limpeza, padronização e disciplina.' },
  { id:'lubrificacao', name:'Lubrificação Básica', description:'Atrito, desgaste, lubrificantes e boas práticas.' },
  { id:'pneumatica', name:'Pneumática Básica', description:'Ar comprimido, válvulas, cilindros e preparação do ar.' },
  { id:'eletrica', name:'Elétrica Básica', description:'Grandezas elétricas, circuitos, proteção e segurança.' }
];
let session = null, profile = null, activeSubject = null, activeTab = 'resumo';

function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(s='') { return s.trim().slice(0,1).toUpperCase() || '?'; }
function shuffleArray(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function toast(message, isError=false) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message; el.className = `toast show ${isError?'error':''}`;
  window.setTimeout(() => el.classList.remove('show'), 3800);
}
function shell(content) {
  app.innerHTML = `<header class="topbar"><a class="brand" href="#"><span class="brand-mark">⚙</span><span>${APP_NAME}<small>Aprender • Praticar • Evoluir</small></span></a><div id="header-actions"></div></header><main>${content}</main><footer>Academia Industrial · Treinamento e desenvolvimento</footer><div id="toast" class="toast"></div>`;
  if (session) document.querySelector('#header-actions').innerHTML = `<span class="user-email">${esc(session.user.email)}</span><button class="btn btn-light btn-small" id="logout">Sair</button>`;
  document.querySelector('#logout')?.addEventListener('click', logout);
}
function authView(mode='login', message='') {
  const isLogin = mode === 'login';
  shell(`<section class="auth-wrap"><div class="auth-hero"><div class="eyebrow">PLATAFORMA DE APRENDIZAGEM</div><h1>Conhecimento que move a indústria.</h1><p>Estude quatro matérias, teste seus conhecimentos e acompanhe sua posição no ranking.</p><div class="hero-pills"><span>5S</span><span>Lubrificação</span><span>Pneumática</span><span>Elétrica</span></div></div><form id="auth-form" class="panel auth-panel"><div class="eyebrow">${isLogin?'BEM-VINDO DE VOLTA':'CRIE SUA CONTA'}</div><h2>${isLogin?'Entrar na plataforma':'Criar acesso'}</h2><p class="muted">${isLogin?'Use seu e-mail e senha para continuar.':'Cadastre-se com o e-mail autorizado pela organização.'}</p>${message?`<div class="inline-message">${esc(message)}</div>`:''}<label class="field">E-mail<input name="email" type="email" autocomplete="email" placeholder="voce@empresa.com" required></label><label class="field">Senha<input name="password" type="password" minlength="8" autocomplete="${isLogin?'current-password':'new-password'}" placeholder="Mínimo de 8 caracteres" required></label>${!isLogin?'<label class="field">Nome para exibição<input name="display_name" maxlength="60" placeholder="Seu nome" required></label>':''}<button class="btn btn-primary full" type="submit">${isLogin?'Entrar':'Criar conta'}</button><button type="button" class="text-button" id="toggle-auth">${isLogin?'Ainda não tem acesso? Criar conta':'Já tem conta? Entrar'}</button><p class="fineprint">O cadastro pode exigir confirmação de e-mail, conforme a configuração do administrador.</p></form></section>`);
  let modeNow = mode;
  document.querySelector('#toggle-auth').addEventListener('click', () => authView(modeNow==='login'?'signup':'login'));
  document.querySelector('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!supabase) { toast('Configure a URL e a chave do Supabase em src/config.js.', true); return; }
    const fd = new FormData(e.currentTarget), email = fd.get('email').toString().trim(), password = fd.get('password').toString();
    const btn = e.currentTarget.querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Aguarde…';
    try {
      if (modeNow === 'login') {
        const {error} = await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
        await boot();
      } else {
        const display_name = fd.get('display_name').toString().trim();
        const {data,error} = await supabase.auth.signUp({email,password,options:{data:{display_name}}});
        if(error) throw error;
        if(data.session) await boot();
        else authView('login','Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre.');
      }
    } catch(err) { toast(err.message || 'Não foi possível autenticar.', true); btn.disabled=false; btn.textContent=modeNow==='login'?'Entrar':'Criar conta'; }
  });
}
async function logout() { await supabase.auth.signOut(); session=null; profile=null; authView(); }
async function boot() {
  if (!supabase) { authView('login','A aplicação precisa ser conectada ao Supabase antes do primeiro uso.'); return; }
  const {data:{session: current}} = await supabase.auth.getSession();
  session = current;
  if (!session) { authView(); return; }
  const {data: p, error} = await supabase.from('profiles').select('id,display_name,role').eq('id',session.user.id).maybeSingle();
  if (error) console.error(error);
  profile = p || {id:session.user.id,display_name:session.user.user_metadata?.display_name || session.user.email,role:'student'};
  await dashboard();
  supabase.auth.onAuthStateChange((_event, next) => { session=next; if(!next){profile=null;authView();} });
}
async function dashboard() {
  shell(`<section class="welcome"><div><div class="eyebrow">SUA TRILHA DE APRENDIZAGEM</div><h1>Olá, ${esc(profile?.display_name || session.user.email?.split('@')[0])}!</h1><p>Estude, responda aos quizzes e acompanhe sua evolução.</p></div><div class="welcome-badge">🏆 <span>O conhecimento vale pontos</span></div></section><section class="stats" id="stats"><div class="stat"><span>Pontos no ranking</span><strong>—</strong></div><div class="stat"><span>Quizzes concluídos</span><strong>—</strong></div><div class="stat"><span>Sua posição</span><strong>—</strong></div></section><div class="dashboard-grid"><section><div class="section-title"><h2>Matérias</h2><span class="muted">4 módulos</span></div><div class="subject-grid" id="subject-grid">${subjects.map((s,i)=>`<article class="subject-card"><div class="subject-body"><div class="subject-card-heading"><span class="subject-index">MÓDULO 0${i+1}</span><h3>${s.name}</h3></div><p class="subject-description">${s.description}</p><div class="subject-progress"><span>Carregando progresso…</span></div><button class="btn btn-primary subject-open" data-id="${s.id}">Abrir matéria <span aria-hidden="true">→</span></button></div></article>`).join('')}</div></section><aside class="panel ranking-panel"><div class="section-title"><h2>🏆 Ranking geral</h2><span class="top-three">TOP 3</span></div><p class="muted small">Conta a melhor pontuação de cada matéria.</p><div id="leaderboard" class="leaderboard"><div class="skeleton">Carregando ranking…</div></div><div class="ranking-note">Os três primeiros colocados serão os premiados conforme as regras definidas pela organização.</div></aside></div>${profile?.role==='admin'?'<section class="panel admin-panel"><div><div class="eyebrow">ADMINISTRAÇÃO</div><h2>Materiais oficiais</h2><p class="muted">Envie PDFs para uma matéria. Os arquivos ficam no armazenamento privado do projeto.</p></div><form id="upload-form" class="upload-form"><label class="field">Matéria<select name="subject_id" required>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')+'</select></label><label class="field">Título do material<input name="title" required maxlength="120" placeholder="Ex.: Apostila oficial de 5S"></label><label class="field">Arquivo PDF<input name="file" type="file" accept="application/pdf,.pdf" required></label><button class="btn btn-primary" type="submit">Enviar PDF</button></form></section>':''}`);
  document.querySelectorAll('.subject-open').forEach(b=>b.addEventListener('click',()=>openSubject(b.dataset.id)));
  await refreshDashboard();
  document.querySelector('#upload-form')?.addEventListener('submit', uploadPdf);
}
async function refreshDashboard() {
  try {
    const [{data: scores,error:sErr},{data: board,error:bErr}] = await Promise.all([
      supabase.from('best_scores').select('subject_id,best_score'),
      supabase.from('leaderboard').select('user_id,display_name,total_points,completed_subjects').limit(50)
    ]);
    if(sErr) throw sErr; if(bErr) throw bErr;
    const mine=(scores||[]), points=mine.reduce((n,x)=>n+Number(x.best_score||0),0), completed=mine.filter(x=>x.best_score!==null).length;
    const position=(board||[]).findIndex(x=>x.user_id===session.user.id)+1;
    document.querySelector('#stats').innerHTML=`<div class="stat"><span>Pontos no ranking</span><strong>${points} <small>pts</small></strong></div><div class="stat"><span>Quizzes concluídos</span><strong>${completed}/4</strong></div><div class="stat"><span>Sua posição</span><strong>${position?'#'+position:'—'}</strong></div>`;
    document.querySelectorAll('.subject-card').forEach(card=>{
      const id=card.querySelector('button').dataset.id, s=mine.find(x=>x.subject_id===id);
      card.querySelector('.subject-progress').innerHTML=s?`<span class="status-done">Melhor resultado: ${s.best_score}/50 pontos</span>`:'<span>Ainda não concluído</span>';
    });
    document.querySelector('#leaderboard').innerHTML=board?.length?board.slice(0,10).map((r,i)=>`<div class="leader-row"><span class="medal">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span><span class="leader-avatar">${esc(initials(r.display_name))}</span><span class="leader-name"><b>${esc(r.display_name)}${r.user_id===session.user.id?' (você)':''}</b><small>${r.completed_subjects}/4 matérias</small></span><b class="leader-points">${r.total_points} pts</b></div>`).join(''):'<p class="muted">Ainda não há resultados. Seja o primeiro!</p>';
  } catch(err) {
    console.error(err); toast('Não foi possível carregar o ranking. Confira se o SQL de configuração foi aplicado.',true);
    document.querySelector('#leaderboard').innerHTML='<p class="muted">Ranking indisponível no momento.</p>';
  }
}
async function openSubject(id) {
  activeSubject=subjects.find(s=>s.id===id); activeTab='resumo';
  shell(`<button class="back-button" id="back">← Voltar ao painel</button><section class="subject-header"><div class="subject-icon-large">${activeSubject.name}</div><div><div class="eyebrow">MÓDULO DE ESTUDO</div><h1>${activeSubject.name}</h1><p>${activeSubject.description}</p></div></section><div class="tabs" id="tabs"></div><section class="panel lesson-panel" id="lesson-content"><div class="skeleton">Carregando material…</div></section>`);
  document.querySelector('#back').addEventListener('click',dashboard);
  renderSubjectTabs(); await renderSubjectTab();
}
function renderSubjectTabs() {
  document.querySelector('#tabs').innerHTML=[['resumo','Resumo'],['apostila','Apostila PDF'],['video','Vídeo'],['quiz','Quiz']].map(([k,t])=>`<button class="tab ${activeTab===k?'active':''}" data-tab="${k}">${t}</button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',async()=>{activeTab=b.dataset.tab;renderSubjectTabs();await renderSubjectTab()}));
}
const summaries = {
 '5s':`<h3>O que é 5S?</h3><p>Metodologia para organizar o local de trabalho, reduzir desperdícios e apoiar a segurança e a eficiência.</p><ol><li><b>Seiri — Utilização:</b> separar o necessário do desnecessário.</li><li><b>Seiton — Ordenação:</b> definir local e identificação para cada item.</li><li><b>Seiso — Limpeza:</b> limpar e inspecionar anomalias.</li><li><b>Seiketsu — Padronização:</b> estabelecer padrões visuais e rotinas.</li><li><b>Shitsuke — Disciplina:</b> manter os padrões continuamente.</li></ol><p>O 5S não é uma limpeza pontual: é um sistema de manutenção do padrão.</p>`,
 'lubrificacao':`<h3>Fundamentos da lubrificação</h3><p>A lubrificação forma uma película entre superfícies em movimento, reduzindo atrito, desgaste e aquecimento. Óleos fluem e podem circular; graxas tendem a permanecer no ponto de aplicação. A viscosidade deve atender à especificação do equipamento.</p><ul><li>Use o lubrificante e a quantidade especificados.</li><li>Evite misturas incompatíveis e contaminação por água ou partículas.</li><li>Registre a atividade e comunique vazamentos, ruídos ou aquecimento.</li><li>Siga os procedimentos de bloqueio e segurança antes de intervir.</li></ul>`,
 'pneumatica':`<h3>Fundamentos da pneumática</h3><p>A pneumática utiliza ar comprimido para acionar mecanismos. O compressor fornece ar; filtros e reguladores ajudam a preparar/controlar o ar; válvulas direcionais controlam o fluxo; cilindros transformam energia pneumática em movimento.</p><ul><li>Cilindro de simples ação: atua geralmente em um sentido e retorna por mola ou força externa.</li><li>Cilindro de dupla ação: o ar atua nos dois sentidos.</li><li>Antes de desmontar linhas, isole a energia e alivie a pressão conforme o procedimento.</li></ul>`,
 'eletrica':`<h3>Fundamentos da elétrica</h3><ul><li><b>Tensão (V):</b> diferença de potencial.</li><li><b>Corrente (A):</b> fluxo de carga elétrica.</li><li><b>Resistência (Ω):</b> oposição à corrente.</li><li><b>Potência (W):</b> taxa de transferência/consumo de energia.</li></ul><p>Lei de Ohm: V = R × I. Em circuito CC simples, P = V × I. Disjuntores e fusíveis protegem contra sobrecorrentes dentro da aplicação e dimensionamento adequados.</p><p>Manutenção elétrica exige pessoas autorizadas, desenergização, bloqueio e verificação de ausência de tensão conforme procedimentos e normas aplicáveis.</p>`
};
async function renderSubjectTab() {
  const box=document.querySelector('#lesson-content'); if(!box)return;
  if(activeTab==='resumo'){box.innerHTML=`<div class="lesson-copy">${summaries[activeSubject.id]}</div>`;return;}
  if(activeTab==='apostila'){
    box.innerHTML='<h2>Apostilas oficiais</h2><p class="muted">Os PDFs enviados pelo administrador para esta matéria aparecerão aqui.</p><div class="skeleton">Buscando arquivos…</div>';
    const {data,error}=await supabase.from('materials').select('id,title,storage_path,created_at').eq('subject_id',activeSubject.id).eq('is_published',true).order('created_at',{ascending:false});
    if(error){box.innerHTML='<p class="muted">Não foi possível carregar os materiais.</p>';return;}
    if(!data?.length){box.innerHTML='<h2>Apostilas oficiais</h2><div class="empty-state">Nenhuma apostila foi publicada para esta matéria ainda.</div>';return;}
    const links=await Promise.all(data.map(async m=>{const {data: signed,error}=await supabase.storage.from('handouts').createSignedUrl(m.storage_path,300);return {...m,url:error?null:signed?.signedUrl}}));
    box.innerHTML=`<h2>Apostilas oficiais</h2><div class="material-list">${links.map(m=>`<div class="material-row"><span class="pdf-icon">PDF</span><div><b>${esc(m.title)}</b><small>Arquivo oficial</small></div>${m.url?`<a class="btn btn-primary btn-small" href="${m.url}" target="_blank" rel="noopener">Abrir PDF</a>`:'<span class="muted">Indisponível</span>'}</div>`).join('')}</div>`;
    return;
  }
  if(activeTab==='video'){
    const queries={'5s':'5S na prática operacional português','lubrificacao':'lubrificação industrial básica português','pneumatica':'pneumática básica industrial português','eletrica':'elétrica básica industrial português'};
    box.innerHTML=`<h2>Vídeo de apoio</h2><p>O link abaixo abre uma busca por vídeos do assunto. O administrador poderá trocar por um vídeo específico aprovado pela empresa na próxima etapa.</p><a class="video-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(queries[activeSubject.id])}" target="_blank" rel="noopener">▶ Encontrar vídeo de ${activeSubject.name}</a>`;return;
  }
  if(activeTab==='quiz'){await renderQuiz(box);}
}
async function renderQuiz(box) {
  box.innerHTML='<h2>Quiz</h2><p class="muted">Carregando perguntas…</p>';
  const {data:loadedQuestions,error}=await supabase.from('quiz_questions').select('id,question_text,options,sort_order').eq('subject_id',activeSubject.id).eq('is_active',true).order('sort_order');
  if(error){box.innerHTML='<p class="muted">Não foi possível carregar o quiz. Confira a configuração do banco.</p>';return;}
  const questions = shuffleArray(loadedQuestions || []);
  if(!questions.length){box.innerHTML='<h2>Quiz</h2><div class="empty-state">As perguntas deste módulo ainda não foram cadastradas.</div>';return;}
  box.innerHTML=`<div class="quiz-heading"><div><h2>Teste seus conhecimentos</h2><p class="muted">${questions.length} perguntas · melhor resultado conta para o ranking</p></div><span class="points-pill">10 pts por acerto</span></div><form id="quiz-form">${questions.map((q,i)=>`<fieldset class="question"><legend>${i+1}. ${esc(q.question_text)}</legend>${shuffleArray(q.options.map((op,j)=>({text:op,index:j}))).map(op=>`<label class="option"><input type="radio" name="${q.id}" value="${op.index}" required> ${esc(op.text)}</label>`).join('')}</fieldset>`).join('')}<button class="btn btn-primary" type="submit">Enviar respostas</button></form><div id="quiz-result"></div>`;
  document.querySelector('#quiz-form').addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;btn.textContent='Corrigindo…';
    const answers=questions.map(q=>({question_id:q.id,selected_option:Number(new FormData(e.currentTarget).get(q.id))}));
    const {data,error}=await supabase.rpc('submit_quiz',{p_subject_id:activeSubject.id,p_answers:answers});
    if(error){toast(error.message||'Falha ao enviar respostas.',true);btn.disabled=false;btn.textContent='Enviar respostas';return;}
    const result=Array.isArray(data)?data[0]:data;
    document.querySelector('#quiz-result').innerHTML=`<div class="result-box"><div class="eyebrow">RESULTADO</div><h2>${result.score}/${questions.length} acertos</h2><p>Esta tentativa vale <b>${result.points_awarded} pontos</b>. Melhor pontuação registrada nesta matéria: <b>${result.best_score}/50</b>.</p><p class="muted">O ranking considera somente a melhor tentativa em cada matéria.</p><button class="btn btn-light" id="back-to-dashboard">Ver ranking atualizado</button></div>`;
    e.currentTarget.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    document.querySelector('#back-to-dashboard').addEventListener('click',dashboard);
  });
}
async function uploadPdf(e) {
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),file=fd.get('file'),subjectId=fd.get('subject_id'),title=fd.get('title').toString().trim();
  if(!file||file.type!=='application/pdf'){toast('Selecione um arquivo PDF válido.',true);return;}
  if(file.size>20*1024*1024){toast('O PDF deve ter no máximo 20 MB.',true);return;}
  const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Enviando…';
  try {
    const safe=file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${subjectId}/${crypto.randomUUID()}-${safe}`;
    const {error:upErr}=await supabase.storage.from('handouts').upload(path,file,{contentType:'application/pdf',upsert:false});
    if(upErr)throw upErr;
    const {error:dbErr}=await supabase.from('materials').insert({subject_id:subjectId,title,storage_path:path,uploaded_by:session.user.id,is_published:true});
    if(dbErr)throw dbErr;
    toast('PDF enviado e publicado.');form.reset();
  } catch(err) {toast(err.message||'Não foi possível enviar o PDF.',true);}
  finally {btn.disabled=false;btn.textContent='Enviar PDF';}
}
if (!configured) authView('login','Protótipo conectado à arquitetura Supabase: preencha src/config.js e aplique supabase/schema.sql para habilitar o acesso online.');
else boot();
