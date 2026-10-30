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
  app.innerHTML = `<header class="topbar"><a class="brand" href="#"><img class="brand-logo" src="/academia-industrial/progeral-logo.svg" alt="Progeral em Boas Mãos"><span>${APP_NAME}<small>Aprender • Praticar • Evoluir</small></span></a><div id="header-actions"></div></header><main>${content}</main><footer>Academia Industrial · Treinamento e desenvolvimento</footer><div id="toast" class="toast"></div>`;
  if (session) document.querySelector('#header-actions').innerHTML = `<button class="btn btn-light btn-small" id="profile-button">Perfil</button><span class="user-email">${esc(session.user.email)}</span><button class="btn btn-light btn-small" id="logout">Sair</button>`;
  document.querySelector('#logout')?.addEventListener('click', logout);
  document.querySelector('#profile-button')?.addEventListener('click', openProfile);
}
function authView(mode='login', message='') {
  const isLogin = mode === 'login';
  shell(`<section class="auth-wrap"><div class="auth-hero"><img class="auth-brand-logo" src="/academia-industrial/progeral-logo.svg" alt="Progeral em Boas Mãos"><div class="eyebrow">PLATAFORMA DE APRENDIZAGEM</div><h1>Conhecimento que move a indústria.</h1><p>Estude quatro matérias, teste seus conhecimentos e acompanhe sua posição no ranking.</p><div class="hero-pills"><span>5S</span><span>Lubrificação</span><span>Pneumática</span><span>Elétrica</span></div></div><form id="auth-form" class="panel auth-panel"><div class="eyebrow">${isLogin?'BEM-VINDO DE VOLTA':'CRIE SUA CONTA'}</div><h2>${isLogin?'Entrar na plataforma':'Criar acesso'}</h2><p class="muted">${isLogin?'Use seu e-mail e senha para continuar.':'Cadastre-se com o e-mail autorizado pela organização.'}</p>${message?`<div class="inline-message">${esc(message)}</div>`:''}<label class="field">E-mail<input name="email" type="email" autocomplete="email" placeholder="voce@empresa.com" required></label><label class="field">Senha<input name="password" type="password" minlength="8" autocomplete="${isLogin?'current-password':'new-password'}" placeholder="Mínimo de 8 caracteres" required></label>${!isLogin?'<label class="field">Nome para exibição<input name="display_name" maxlength="60" placeholder="Seu nome" required></label><label class="field">Setor em que trabalha<input name="department" maxlength="80" placeholder="Ex.: Produção, Qualidade, Manutenção" required></label>':''}<button class="btn btn-primary full" type="submit">${isLogin?'Entrar':'Criar conta'}</button><button type="button" class="text-button" id="toggle-auth">${isLogin?'Ainda não tem acesso? Criar conta':'Já tem conta? Entrar'}</button><p class="fineprint">O cadastro pode exigir confirmação de e-mail, conforme a configuração do administrador.</p></form></section>`);
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
        const display_name = fd.get('display_name').toString().trim(), department = fd.get('department').toString().trim();
        const {data,error} = await supabase.auth.signUp({email,password,options:{data:{display_name,department}}});
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
  const {data: p, error} = await supabase.from('profiles').select('id,display_name,role,department,created_at').eq('id',session.user.id).maybeSingle();
  if (error) console.error(error);
  profile = p || {id:session.user.id,display_name:session.user.user_metadata?.display_name || session.user.email,role:'student',department:session.user.user_metadata?.department || ''};
  await dashboard();
  supabase.auth.onAuthStateChange((_event, next) => { session=next; if(!next){profile=null;authView();} });
}
async function dashboard() {
  shell(`<section class="welcome"><div><div class="eyebrow">SUA TRILHA DE APRENDIZAGEM</div><h1>Olá, ${esc(profile?.display_name || session.user.email?.split('@')[0])}!</h1><p>Estude, responda aos quizzes e acompanhe sua evolução.</p></div><div class="welcome-badge">🏆 <span>O conhecimento vale pontos</span></div></section><section class="stats" id="stats"><div class="stat"><span>Pontos no ranking</span><strong>—</strong></div><div class="stat"><span>Quizzes concluídos</span><strong>—</strong></div><div class="stat"><span>Sua posição</span><strong>—</strong></div></section><div class="dashboard-grid"><section><div class="section-title"><h2>Matérias</h2><span class="muted">4 módulos</span></div><div class="subject-grid" id="subject-grid">${subjects.map((s,i)=>`<article class="subject-card"><div class="subject-body"><div class="subject-card-heading"><span class="subject-index">MÓDULO 0${i+1}</span><h3>${s.name}</h3></div><p class="subject-description">${s.description}</p><div class="subject-progress"><span>Carregando progresso…</span></div><button class="btn btn-primary subject-open" data-id="${s.id}">Abrir matéria <span aria-hidden="true">→</span></button></div></article>`).join('')}</div></section><aside class="panel ranking-panel"><div class="section-title"><h2>🏆 Ranking geral</h2><span class="top-three">TOP 3</span></div><p class="muted small">Conta a melhor pontuação de cada matéria.</p><div id="leaderboard" class="leaderboard"><div class="skeleton">Carregando ranking…</div></div><div class="ranking-note">Os três primeiros colocados serão os premiados conforme as regras definidas pela organização.</div></aside></div>${profile?.role==='admin'?'<section class="panel admin-panel"><div><div class="eyebrow">ADMINISTRAÇÃO</div><h2>Materiais oficiais</h2><p class="muted">Envie PDFs para uma matéria. Os arquivos ficam no armazenamento privado do projeto.</p></div><form id="upload-form" class="upload-form"><label class="field">Matéria<select name="subject_id" required>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')+'</select></label><label class="field">Título do material<input name="title" required maxlength="120" placeholder="Ex.: Apostila oficial de 5S"></label><label class="field">Arquivo PDF<input name="file" type="file" accept="application/pdf,.pdf" required></label><button class="btn btn-primary" type="submit">Enviar PDF</button></form><div><h3>Vídeos de treinamento</h3><p class="muted">Envie um vídeo MP4 de até 100 MB para a matéria escolhida.</p><form id="video-upload-form" class="upload-form"><label class="field">Matéria<select name="subject_id" required>'+subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')+'</select></label><label class="field">Título do vídeo<input name="title" required maxlength="120" placeholder="Ex.: 5S na prática"></label><label class="field">Arquivo MP4<input name="file" type="file" accept="video/mp4,.mp4" required></label><button class="btn btn-primary" type="submit">Enviar vídeo</button></form></div></section>':''}`);
  document.querySelectorAll('.subject-open').forEach(b=>b.addEventListener('click',()=>openSubject(b.dataset.id)));
  await refreshDashboard();
  document.querySelector('#upload-form')?.addEventListener('submit', uploadPdf);
  document.querySelector('#video-upload-form')?.addEventListener('submit', uploadVideo);
}
async function openProfile() {
  shell(`<button class="back-button" id="profile-back">← Voltar ao painel</button>
    <section class="profile-heading"><div class="eyebrow">ÁREA DO PARTICIPANTE</div><h1>Meu perfil</h1><p class="muted">Seus dados e seu progresso geral na Academia Industrial.</p></section>
    <section class="profile-summary" id="profile-summary"><div class="skeleton">Carregando seus dados…</div></section>
    <section class="panel profile-progress"><div class="section-title"><h2>Andamento dos cursos</h2><span class="muted">Visão geral</span></div><div id="profile-courses" class="profile-course-list"><div class="skeleton">Carregando cursos…</div></div></section>`);
  document.querySelector('#profile-back').addEventListener('click',dashboard);
  try {
    const [{data: attempts,error:aErr},{data: p,error:pErr}] = await Promise.all([
      supabase.from('quiz_attempts').select('subject_id,quiz_key,points,submitted_at').eq('user_id',session.user.id).order('submitted_at',{ascending:true}),
      supabase.from('profiles').select('display_name,department,created_at').eq('id',session.user.id).single()
    ]);
    if(aErr) throw aErr;
    if(pErr) throw pErr;
    const rows=attempts||[];
    const totalPoints=rows.reduce((sum,a)=>sum+Number(a.points||0),0);
    const quizzes=new Set(rows.map(a=>a.subject_id+':'+(a.quiz_key||'normal')));
    const completedSubjects=new Set(rows.map(a=>a.subject_id));
    const created=p.created_at?new Date(p.created_at).toLocaleDateString('pt-BR'):'—';
    document.querySelector('#profile-summary').innerHTML=`
      <article class="profile-data-card"><span>Nome</span><strong>${esc(p.display_name||'—')}</strong></article>
      <article class="profile-data-card"><span>E-mail</span><strong>${esc(session.user.email||'—')}</strong></article>
      <article class="profile-data-card"><span>Setor</span><strong>${esc(p.department||'Não informado')}</strong></article>
      <article class="profile-data-card"><span>Membro desde</span><strong>${created}</strong></article>
      <article class="profile-data-card"><span>Pontos acumulados</span><strong>${totalPoints} pts</strong></article>
      <article class="profile-data-card"><span>Quizzes concluídos</span><strong>${quizzes.size}</strong></article>`;
    document.querySelector('#profile-courses').innerHTML=subjects.map(subject=>{
      const subjectAttempts=rows.filter(a=>a.subject_id===subject.id);
      const subjectQuizCount=new Set(subjectAttempts.map(a=>a.quiz_key||'normal')).size;
      const points=subjectAttempts.reduce((sum,a)=>sum+Number(a.points||0),0);
      const done=completedSubjects.has(subject.id);
      return `<article class="profile-course"><div class="profile-course-top"><div><h3>${esc(subject.name)}</h3><p>${esc(subject.description)}</p></div><span class="profile-course-status ${done?'is-done':''}">${done?'Em andamento':'Não iniciado'}</span></div><div class="profile-course-metrics"><span>${subjectQuizCount} quiz(es) concluído(s)</span><strong>${points} pontos</strong></div></article>`;
    }).join('');
  } catch(err) {
    console.error('Falha ao carregar perfil:',err);
    toast(err.message||'Não foi possível carregar seu perfil.',true);
    document.querySelector('#profile-summary').innerHTML='<p class="muted">Não foi possível carregar os dados do perfil.</p>';
    document.querySelector('#profile-courses').innerHTML='<p class="muted">Não foi possível carregar o andamento dos cursos.</p>';
  }
}
async function refreshDashboard() {
  try {
    const [{data: attempts,error:aErr},{data: board,error:bErr}] = await Promise.all([
      supabase.from('quiz_attempts').select('subject_id,points,quiz_key,submitted_at').eq('user_id',session.user.id),
      supabase.from('leaderboard').select('user_id,display_name,total_points,completed_subjects').order('total_points',{ascending:false}).order('display_name',{ascending:true}).limit(50)
    ]);
    if(aErr) throw aErr; if(bErr) throw bErr;
    // A pontuação do card é a soma dos pontos concedidos em todos os quizzes da matéria.
    // As tentativas repetidas recebem zero pontos pela RPC submit_quiz.
    const mine=Object.values((attempts||[]).reduce((acc,a)=>{
      const id=a.subject_id;
      if(!acc[id]) acc[id]={subject_id:id,best_score:0};
      acc[id].best_score+=Number(a.points||0);
      return acc;
    },{})), myRanking=(board||[]).find(x=>x.user_id===session.user.id), points=Number(myRanking?.total_points||0), completed=Number(myRanking?.completed_subjects||0);
    const position=(board||[]).findIndex(x=>x.user_id===session.user.id)+1;
    document.querySelector('#stats').innerHTML=`<div class="stat"><span>Pontos no ranking</span><strong>${points} <small>pts</small></strong></div><div class="stat"><span>Quizzes concluídos</span><strong>${completed}</strong></div><div class="stat"><span>Sua posição</span><strong>${position?'#'+position:'—'}</strong></div>`;
    document.querySelectorAll('.subject-card').forEach(card=>{
      const id=card.querySelector('button').dataset.id, s=mine.find(x=>x.subject_id===id);
      card.querySelector('.subject-progress').innerHTML=s?`<span class="status-done">Pontos obtidos: ${s.best_score} pontos</span>`:'<span>Ainda não concluído</span>';
    });
    document.querySelector('#leaderboard').innerHTML=board?.length?board.slice(0,10).map((r,i)=>`<div class="leader-row"><span class="medal">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span><span class="leader-avatar">${esc(initials(r.display_name))}</span><span class="leader-name"><b>${esc(r.display_name)}${r.user_id===session.user.id?' (você)':''}</b></span><b class="leader-points">${r.total_points} pts</b></div>`).join(''):'<p class="muted">Ainda não há resultados. Seja o primeiro!</p>';
  } catch(err) {
    console.error('Falha ao atualizar painel/ranking:', {message:err?.message,code:err?.code,details:err?.details,hint:err?.hint});
    const detail = [err?.message, err?.code ? 'Código: '+err.code : '', err?.hint].filter(Boolean).join(' — ');
    toast(detail ? 'Falha no ranking: '+detail : 'Não foi possível carregar o ranking. Confira o console do navegador.',true);
    const board=document.querySelector('#leaderboard');
    if(board) board.innerHTML='<p class="muted">Ranking indisponível. Abra o console do navegador (F12) para ver o erro técnico.</p>';
  }
}
async function openSubject(id) {
  activeSubject=subjects.find(s=>s.id===id); activeTab='resumo';
  shell(`<button class="back-button" id="back">← Voltar ao painel</button><section class="subject-header"><div class="subject-icon-large">${activeSubject.name}</div><div><div class="eyebrow">MÓDULO DE ESTUDO</div><h1>${activeSubject.name}</h1><p>${activeSubject.description}</p></div></section><div class="tabs" id="tabs"></div><section class="panel lesson-panel" id="lesson-content"><div class="skeleton">Carregando material…</div></section>`);
  document.querySelector('#back').addEventListener('click',dashboard);
  renderSubjectTabs(); await renderSubjectTab();
}
function renderSubjectTabs() {
  const tabs=[['resumo','Resumo'],['apostila','Apostila PDF'],['video','Vídeo'],['quiz','Quiz']];
  if(activeSubject?.id==='5s') tabs.push(['seiri','Quiz Seiri']);
  if(activeSubject?.id==='lubrificacao') tabs.push(['lubrificacao-quiz','Quiz Interativo']);
  document.querySelector('#tabs').innerHTML=tabs.map(([k,t])=>`<button class="tab ${activeTab===k?'active':''}" data-tab="${k}">${t}</button>`).join('');
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
    box.innerHTML=`<h2>Apostilas oficiais</h2><p class="muted">${profile?.role==='admin'?'Como administrador, você pode excluir somente os arquivos desta matéria.':'Materiais oficiais desta matéria.'}</p><div class="material-list">${links.map(m=>`<div class="material-row"><span class="pdf-icon">PDF</span><div><b>${esc(m.title)}</b><small>Arquivo oficial</small></div>${m.url?`<a class="btn btn-primary btn-small" href="${m.url}" target="_blank" rel="noopener">Abrir PDF</a>`:'<span class="muted">Indisponível</span>'}${profile?.role==='admin'? `<button class="btn btn-small admin-delete-content" type="button" data-delete-material="${m.id}">Excluir</button>`:''}</div>`).join('')}</div>`;
    if(profile?.role==='admin') box.querySelectorAll('[data-delete-material]').forEach(button=>button.addEventListener('click',()=>deleteSubjectFile('material',links.find(m=>m.id===button.dataset.deleteMaterial))));
    return;
  }
  if(activeTab==='video'){
    box.innerHTML='<h2>Vídeos de treinamento</h2><p class="muted">Vídeos oficiais desta matéria.</p><div class="skeleton">Buscando vídeos…</div>';
    const {data,error}=await supabase.from('videos').select('id,title,storage_path,created_at').eq('subject_id',activeSubject.id).eq('is_published',true).order('created_at',{ascending:true}).order('id',{ascending:true});
    if(error){console.error(error);box.innerHTML='<h2>Vídeos de treinamento</h2><p class="muted">Não foi possível carregar os vídeos. Confira se o SQL de configuração de vídeos foi aplicado no Supabase.</p>';return;}
    if(!data?.length){box.innerHTML='<h2>Vídeos de treinamento</h2><div class="empty-state">Nenhum vídeo foi publicado para esta matéria ainda.</div>';return;}
    const items=await Promise.all(data.map(async v=>{const {data:signed,error:urlError}=await supabase.storage.from('training-videos').createSignedUrl(v.storage_path,3600);return {...v,url:urlError?null:signed?.signedUrl}}));
    box.innerHTML='<h2>Vídeos de treinamento</h2><p class="muted">'+(profile?.role==='admin'?'Como administrador, você pode excluir somente os vídeos desta matéria.':'Vídeos oficiais desta matéria.')+'</p><p class="video-order-note">Organizados do vídeo mais antigo ao mais recente. Selecione um título para abrir o vídeo.</p><div class="training-video-list">'+items.map((v,i)=>`<article class="training-video"><button class="training-video-title" type="button" data-toggle-video="${v.id}" aria-expanded="false" aria-controls="video-panel-${v.id}"><span class="training-video-number">${String(i+1).padStart(2,'0')}</span><span class="training-video-title-text"><strong>${esc(v.title)}</strong><small>${v.created_at? 'Enviado em '+new Date(v.created_at).toLocaleDateString('pt-BR'):'Vídeo de treinamento'}</small></span><span class="training-video-chevron" aria-hidden="true">⌄</span></button><div class="training-video-panel" id="video-panel-${v.id}" hidden>${v.url?`<video class="training-video-player" controls playsinline preload="none"><source src="${esc(v.url)}" type="video/mp4">Seu navegador não suporta a reprodução deste vídeo.</video>`:'<p class="muted">Vídeo indisponível no momento.</p>'}</div>${profile?.role==='admin'? `<button class="btn btn-small admin-delete-content" type="button" data-delete-video="${v.id}">Excluir vídeo</button>`:''}</article>`).join('')+'</div>';
    box.querySelectorAll('[data-toggle-video]').forEach(button=>button.addEventListener('click',()=>{
      const panel=document.getElementById(button.getAttribute('aria-controls'));
      const willOpen=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(willOpen));
      if(panel) panel.hidden=!willOpen;
      button.querySelector('.training-video-chevron').textContent=willOpen?'⌃':'⌄';
    }));
    if(profile?.role==='admin') box.querySelectorAll('[data-delete-video]').forEach(button=>button.addEventListener('click',()=>deleteSubjectFile('video',items.find(v=>v.id===button.dataset.deleteVideo))));
    return;
  }
  if(activeTab==='quiz'){await renderQuiz(box);return;}
  if(activeTab==='seiri'){await renderSeiriQuiz(box);return;}
  if(activeTab==='lubrificacao-quiz'){await renderLubricationQuiz(box);}
}
async function deleteSubjectFile(kind, file) {
  if (profile?.role !== 'admin' || !file || file.subject_id !== activeSubject?.id) {
    toast('A exclusão só está disponível para administradores dentro da matéria correspondente.', true);
    return;
  }
  const label = kind === 'video' ? 'vídeo' : 'PDF';
  const subjectName = activeSubject.name;
  const confirmed = window.confirm(
    `ATENÇÃO: você está na matéria "${subjectName}".\n\nDeseja excluir o ${label} "${file.title}"? O arquivo será removido permanentemente.`
  );
  if (!confirmed) return;
  const typed = window.prompt('Para confirmar a exclusão permanente, digite EXCLUIR (em letras maiúsculas):');
  if (typed !== 'EXCLUIR') {
    toast('Exclusão cancelada. A confirmação não corresponde.', true);
    return;
  }
  const button = document.querySelector(`[data-delete-${kind === 'video' ? 'video' : 'material'}="${file.id}"]`);
  if (button) { button.disabled = true; button.textContent = 'Excluindo…'; }
  const table = kind === 'video' ? 'videos' : 'materials';
  const bucket = kind === 'video' ? 'training-videos' : 'handouts';
  try {
    const {error: storageError} = await supabase.storage.from(bucket).remove([file.storage_path]);
    if (storageError) throw storageError;
    const {error: dbError} = await supabase.from(table).delete().eq('id', file.id).eq('subject_id', activeSubject.id);
    if (dbError) throw dbError;
    toast(`${kind === 'video' ? 'Vídeo' : 'PDF'} excluído da matéria ${subjectName}.`);
    await renderSubjectTab();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Não foi possível excluir o arquivo.', true);
    if (button) { button.disabled = false; button.textContent = kind === 'video' ? 'Excluir vídeo' : 'Excluir'; }
  }
}

async function renderQuiz(box) {
  box.innerHTML='<h2>Quiz</h2><p class="muted">Carregando perguntas…</p>';
  const {data:loadedQuestions,error}=await supabase.from('quiz_questions').select('id,question_text,options,sort_order').eq('subject_id',activeSubject.id).eq('is_active',true).lt('sort_order',9001).order('sort_order');
  if(error){box.innerHTML='<p class="muted">Não foi possível carregar o quiz. Confira a configuração do banco.</p>';return;}
  const questionPool = loadedQuestions || [];
  if(!questionPool.length){box.innerHTML='<h2>Quiz</h2><div class="empty-state">As perguntas deste módulo ainda não foram cadastradas.</div>';return;}
  if(questionPool.length < 10){box.innerHTML=`<h2>Quiz</h2><div class="empty-state">Esta matéria precisa ter pelo menos 10 perguntas ativas. No momento, há ${questionPool.length}.</div>`;return;}
  const questions = shuffleArray(questionPool).slice(0,10);
  box.innerHTML=`<div class="quiz-heading"><div><h2>Teste seus conhecimentos</h2><p class="muted">10 perguntas sorteadas de ${questionPool.length} disponíveis · somente a primeira tentativa conta para o ranking</p></div><span class="points-pill">10 pts por acerto</span></div><form id="quiz-form">${questions.map((q,i)=>`<fieldset class="question"><legend>${i+1}. ${esc(q.question_text)}</legend>${shuffleArray(q.options.map((op,j)=>({text:op,index:j}))).map(op=>`<label class="option"><input type="radio" name="${q.id}" value="${op.index}" required> ${esc(op.text)}</label>`).join('')}</fieldset>`).join('')}<button class="btn btn-primary" type="submit">Enviar respostas</button></form><div id="quiz-result"></div>`;
  document.querySelector('#quiz-form').addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;btn.textContent='Corrigindo…';
    const answers=questions.map(q=>({question_id:q.id,selected_option:Number(new FormData(e.currentTarget).get(q.id))}));
    const {data,error}=await supabase.rpc('submit_quiz',{p_subject_id:activeSubject.id,p_answers:answers});
    if(error){toast(error.message||'Falha ao enviar respostas.',true);btn.disabled=false;btn.textContent='Enviar respostas';return;}
    const result=Array.isArray(data)?data[0]:data;
    document.querySelector('#quiz-result').innerHTML=`<div class="result-box"><div class="eyebrow">RESULTADO</div><h2>${result.score}/${questions.length} acertos</h2><p>${result.is_first_attempt?'Você ganhou <b>'+result.points_awarded+' pontos</b> nesta primeira tentativa.':'Este quiz já foi concluído anteriormente. Você ganhou <b>0 pontos adicionais</b>; somente a primeira tentativa conta para o ranking.'}</p><p class="muted">Pontos acumulados nesta matéria: <b>${result.best_score}</b>. Cada quiz diferente pode somar pontos uma única vez.</p><button class="btn btn-light" id="back-to-dashboard">Ver ranking atualizado</button></div>`;
    e.currentTarget.querySelectorAll('input,button').forEach(el=>el.disabled=true);
    document.querySelector('#back-to-dashboard').addEventListener('click',dashboard);
  });
}

async function renderSeiriQuiz(box) {
  box.innerHTML='<h2>Encontro 1: Introdução ao 5S e Seiri</h2><p class="muted">Carregando as cinco questões…</p>';
  const {data:questions,error}=await supabase.from('quiz_questions')
    .select('id,question_text,options,correct_option,explanation,sort_order')
    .eq('subject_id','5s').eq('is_active',true).gte('sort_order',9001).lte('sort_order',9005).order('sort_order');
  if(error){console.error(error);box.innerHTML='<h2>Quiz Seiri</h2><div class="empty-state">Não foi possível carregar este quiz. O administrador precisa aplicar o arquivo supabase/quiz_5s_seiri.sql no Supabase.</div>';return;}
  if(!questions || questions.length!==5){box.innerHTML='<h2>Encontro 1: Introdução ao 5S e Seiri</h2><div class="empty-state">Este quiz ainda não está configurado no banco. Peça ao administrador para aplicar o arquivo SQL de configuração.</div>';return;}
  box.innerHTML=`
    <div class="seiri-wrap">
      <div class="seiri-heading"><span class="seiri-kicker">MÓDULO 1 · 5S</span><h2>Encontro 1: Introdução ao 5S &amp; Seiri</h2><p class="muted">Cinco questões sobre utilização, triagem e organização do posto de trabalho.</p></div>
      <div id="seiri-start" class="seiri-start"><div class="seiri-icon">▦</div><h3>Pronto para testar seus conhecimentos?</h3><p>Você terá 35 segundos por questão, mas o cronômetro só começa quando clicar em “Iniciar tempo”. Ao final, sua pontuação será registrada no ranking.</p><div class="seiri-facts"><span>5 questões</span><span>35s por questão</span><span>Até 100 pontos</span></div><button class="btn btn-primary" id="seiri-begin">Começar quiz</button></div>
      <div id="seiri-game" class="seiri-game" hidden>
        <div class="seiri-status"><span id="seiri-counter">Questão 1 de 5</span><span id="seiri-points">0 pontos provisórios</span></div>
        <div class="seiri-progress"><div id="seiri-progress-bar"></div></div>
        <div class="seiri-timer-row"><button class="btn seiri-timer-start" id="seiri-timer-start">▶ Iniciar tempo</button><span class="seiri-timer" id="seiri-timer">35s</span></div>
        <h3 id="seiri-question"></h3><div id="seiri-options" class="seiri-options"></div>
        <div id="seiri-feedback" class="seiri-feedback" hidden></div>
        <div class="seiri-controls"><span id="seiri-hint">Selecione uma alternativa antes que o tempo termine.</span><button class="btn btn-primary" id="seiri-next" disabled>Avançar →</button></div>
      </div>
      <div id="seiri-result" class="seiri-result" hidden></div>
    </div>`;
  let index=0, timer=null, timeLeft=35, timerStarted=false, selected=null, correctCount=0, totalSeconds=0;
  const answers=[];
  const start=document.querySelector('#seiri-start'), game=document.querySelector('#seiri-game'), resultBox=document.querySelector('#seiri-result');
  const timerBtn=document.querySelector('#seiri-timer-start'), nextBtn=document.querySelector('#seiri-next');
  function stopTimer(){if(timer){clearInterval(timer);timer=null;}timerStarted=false;}
  function startTimer(){
    if(timerStarted||selected!==null)return;
    timerStarted=true;timerBtn.disabled=true;timerBtn.textContent='⏱ Tempo em andamento';
    document.querySelector('#seiri-hint').textContent='O tempo está correndo automaticamente. Escolha uma alternativa.';
    timer=setInterval(()=>{
      timeLeft--;totalSeconds++;
      document.querySelector('#seiri-timer').textContent=timeLeft+'s';
      document.querySelector('#seiri-progress-bar').style.width=(timeLeft/35*100)+'%';
      if(timeLeft<=5)document.querySelector('#seiri-timer').classList.add('urgent');
      if(timeLeft<=0){stopTimer();const wrongIndex=questions[index].correct_option===0?1:0;choose(wrongIndex,true);}
    },1000);
  }
  function loadQuestion(){
    stopTimer();timeLeft=35;selected=null;
    const q=questions[index];
    document.querySelector('#seiri-counter').textContent='Questão '+(index+1)+' de '+questions.length;
    document.querySelector('#seiri-points').textContent=(correctCount*20)+' pontos provisórios';
    document.querySelector('#seiri-question').textContent=q.question_text;
    document.querySelector('#seiri-timer').textContent='35s';
    document.querySelector('#seiri-timer').classList.remove('urgent');
    document.querySelector('#seiri-progress-bar').style.width='100%';
    timerBtn.disabled=false;timerBtn.textContent='▶ Iniciar tempo';
    document.querySelector('#seiri-hint').textContent='Leia as alternativas e inicie o cronômetro quando estiver pronto.';
    document.querySelector('#seiri-feedback').hidden=true;
    nextBtn.disabled=true;nextBtn.textContent=index===questions.length-1?'Ver resultado':'Avançar →';
    const options=document.querySelector('#seiri-options');
    options.innerHTML=shuffleArray(q.options.map((label,originalIndex)=>({label,originalIndex}))).map((op,i)=>`<button type="button" class="seiri-option" data-option="${op.originalIndex}"><span class="seiri-letter">${String.fromCharCode(65+i)}</span><span>${esc(op.label)}</span></button>`).join('');
    options.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.option),false)));
    startTimer();
  }
  function choose(optionIndex,timedOut){
    if(selected!==null)return;
    selected=optionIndex;stopTimer();
    const q=questions[index],isCorrect=optionIndex===q.correct_option;
    if(isCorrect)correctCount++;
    answers.push({question_id:q.id,selected_option:optionIndex});
    document.querySelectorAll('#seiri-options button').forEach(b=>{
      const n=Number(b.dataset.option);b.disabled=true;
      if(n===q.correct_option)b.classList.add('is-correct');
      else if(n===optionIndex)b.classList.add('is-wrong');
    });
    const feedback=document.querySelector('#seiri-feedback');
    feedback.hidden=false;feedback.className='seiri-feedback '+(isCorrect?'feedback-correct':'feedback-wrong');
    feedback.innerHTML='<strong>'+(timedOut?'Tempo esgotado. ':isCorrect?'Resposta correta! ':'Não foi dessa vez. ')+'</strong>'+esc(q.explanation);
    document.querySelector('#seiri-points').textContent=(correctCount*20)+' pontos provisórios';
    document.querySelector('#seiri-hint').textContent=timedOut?'A questão foi marcada como incorreta porque o tempo terminou.':'Confira a explicação antes de avançar.';
    nextBtn.disabled=false;
  }
  async function finish(){
    nextBtn.disabled=true;nextBtn.textContent='Registrando resultado…';
    const {data,error}=await supabase.rpc('submit_quiz',{p_subject_id:'5s',p_answers:answers});
    if(error){toast(error.message||'Não foi possível registrar a pontuação.',true);nextBtn.disabled=false;nextBtn.textContent='Tentar registrar novamente';return;}
    const final=Array.isArray(data)?data[0]:data;
    game.hidden=true;resultBox.hidden=false;
    const percent=Math.round(final.score/questions.length*100);
    resultBox.innerHTML=`<div class="seiri-result-medal">${percent===100?'🏆':percent>=60?'⭐':'📘'}</div><span class="seiri-kicker">RESULTADO DO ENCONTRO 1</span><h2>${percent===100?'Desempenho perfeito!':percent>=60?'Bom desempenho!':'Vamos revisar?'}</h2><div class="seiri-final-stats"><div><small>Acertos</small><strong>${final.score}/${questions.length}</strong></div><div><small>Aproveitamento</small><strong>${percent}%</strong></div><div><small>Tempo</small><strong>${totalSeconds}s</strong></div></div><p>${final.is_first_attempt?'Você ganhou <b>'+final.points_awarded+' pontos</b> nesta primeira tentativa.':'Este quiz já foi concluído anteriormente; você ganhou <b>0 pontos adicionais</b>, pois somente a primeira tentativa conta.'} Pontos acumulados em 5S: <b>${final.best_score}</b>.</p><p class="muted">Cada quiz soma pontos uma única vez. Refazer este quiz não aumenta o ranking.</p><div class="seiri-review"><h3>Revisão das respostas</h3>${questions.map((q,i)=>{const a=answers[i];return `<article class="seiri-review-item"><strong>${i+1}. ${esc(q.question_text)}</strong><p class="${a.selected_option===q.correct_option?'review-good':'review-bad'}">${a.selected_option===q.correct_option?'✓ Resposta correta':'✕ Resposta incorreta'} — ${esc(q.options[q.correct_option])}</p><p>${esc(q.explanation)}</p></article>`;}).join('')}</div><div class="seiri-result-actions"><button class="btn btn-primary" id="seiri-retry">Tentar novamente</button><button class="btn btn-light" id="seiri-dashboard">Ver ranking atualizado</button></div>`;
    document.querySelector('#seiri-retry').addEventListener('click',()=>renderSeiriQuiz(box));
    document.querySelector('#seiri-dashboard').addEventListener('click',dashboard);
  }
  document.querySelector('#seiri-begin').addEventListener('click',()=>{start.hidden=true;game.hidden=false;loadQuestion();});
  timerBtn.addEventListener('click',startTimer);
  nextBtn.addEventListener('click',()=>{if(selected===null)return;if(index<questions.length-1){index++;loadQuestion();}else finish();});
}

async function renderLubricationQuiz(box) {
  box.innerHTML='<h2>Quiz Interativo — Lubrificação Básica</h2><p class="muted">Carregando as cinco questões…</p>';
  const {data:questions,error}=await supabase.from('quiz_questions')
    .select('id,question_text,options,correct_option,explanation,sort_order')
    .eq('subject_id','lubrificacao').eq('is_active',true).gte('sort_order',9101).lte('sort_order',9105).order('sort_order');
  if(error){console.error(error);box.innerHTML='<h2>Quiz de Lubrificação</h2><div class="empty-state">Não foi possível carregar o quiz. O administrador precisa aplicar o arquivo supabase/quiz_lubrificacao.sql no Supabase.</div>';return;}
  if(!questions || questions.length!==5){box.innerHTML='<h2>Quiz Interativo — Lubrificação Básica</h2><div class="empty-state">Este quiz ainda não está configurado no banco. O administrador deve executar o arquivo supabase/quiz_lubrificacao.sql no Supabase.</div>';return;}
  box.innerHTML=`
    <div class="seiri-wrap lubrificacao-theme">
      <div class="seiri-heading"><span class="seiri-kicker">MANUTENÇÃO INDUSTRIAL</span><h2>Quiz Lubrificação Básica</h2><p class="muted">Avaliação de conhecimentos sobre atrito, desgaste, funções dos lubrificantes, falhas no processo e quantidade correta de aplicação.</p></div>
      <div id="lub-start" class="seiri-start"><div class="seiri-icon">💧</div><h3>Avaliação de Conhecimentos em Lubrificação</h3><p>Teste seus conhecimentos sobre atrito, desgaste, funções dos lubrificantes, falhas no processo e volume ideal de aplicação em componentes mecânicos.</p><div class="seiri-facts"><span>⏱ 35s por questão</span><span>🔊 Interativo</span><span>✦ Gabarito comentado</span></div><button class="btn btn-primary" id="lub-begin">Começar quiz</button></div>
      <div id="lub-game" class="seiri-game" hidden>
        <div class="seiri-status"><span id="lub-counter">Questão 1 de 5</span><span id="lub-points">0 pontos provisórios</span></div>
        <div class="seiri-progress"><div id="lub-progress-bar"></div></div>
        <div class="seiri-timer-row"><button class="btn seiri-timer-start" id="lub-timer-start">▶ Iniciar tempo</button><span class="seiri-timer" id="lub-timer">35s</span></div>
        <h3 id="lub-question"></h3><div id="lub-options" class="seiri-options"></div>
        <div id="lub-feedback" class="seiri-feedback" hidden></div>
        <div class="seiri-controls"><span id="lub-hint">Leia as alternativas e inicie o cronômetro quando estiver pronto.</span><button class="btn btn-primary" id="lub-next" disabled>Avançar →</button></div>
      </div>
      <div id="lub-result" class="seiri-result" hidden></div>
    </div>`;
  let index=0,timer=null,timeLeft=35,timerStarted=false,selected=null,correctCount=0,totalSeconds=0;
  const answers=[];
  const start=document.querySelector('#lub-start'),game=document.querySelector('#lub-game'),resultBox=document.querySelector('#lub-result');
  const timerBtn=document.querySelector('#lub-timer-start'),nextBtn=document.querySelector('#lub-next');
  function stopTimer(){if(timer){clearInterval(timer);timer=null;}timerStarted=false;}
  function startTimer(){
    if(timerStarted||selected!==null)return;
    timerStarted=true;timerBtn.disabled=true;timerBtn.textContent='⏱ Tempo em andamento';
    document.querySelector('#lub-hint').textContent='O tempo está correndo. Escolha uma alternativa.';
    timer=setInterval(()=>{timeLeft--;totalSeconds++;document.querySelector('#lub-timer').textContent=timeLeft+'s';document.querySelector('#lub-progress-bar').style.width=(timeLeft/35*100)+'%';if(timeLeft<=5)document.querySelector('#lub-timer').classList.add('urgent');if(timeLeft<=0){stopTimer();choose(questions[index].correct_option===0?1:0,true);}},1000);
  }
  function loadQuestion(){
    stopTimer();timeLeft=35;selected=null;
    const q=questions[index];
    document.querySelector('#lub-counter').textContent='Questão '+(index+1)+' de '+questions.length;
    document.querySelector('#lub-points').textContent=(correctCount*20)+' pontos provisórios';
    document.querySelector('#lub-question').textContent=q.question_text;
    document.querySelector('#lub-timer').textContent='35s';document.querySelector('#lub-timer').classList.remove('urgent');
    document.querySelector('#lub-progress-bar').style.width='100%';
    timerBtn.disabled=false;timerBtn.textContent='⏱ Tempo em andamento';
    document.querySelector('#lub-hint').textContent='Leia as alternativas e inicie o cronômetro quando estiver pronto.';
    document.querySelector('#lub-feedback').hidden=true;nextBtn.disabled=true;
    nextBtn.textContent=index===questions.length-1?'Ver resultado':'Avançar →';
    const options=document.querySelector('#lub-options');
    options.innerHTML=shuffleArray(q.options.map((label,originalIndex)=>({label,originalIndex}))).map((op,i)=>`<button type="button" class="seiri-option" data-option="${op.originalIndex}"><span class="seiri-letter">${String.fromCharCode(65+i)}</span><span>${esc(op.label)}</span></button>`).join('');
    options.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.option),false)));
    startTimer();
  }
  function choose(optionIndex,timedOut){
    if(selected!==null)return;
    selected=optionIndex;stopTimer();
    const q=questions[index],isCorrect=optionIndex===q.correct_option;
    if(isCorrect)correctCount++;
    answers.push({question_id:q.id,selected_option:optionIndex});
    document.querySelectorAll('#lub-options button').forEach(b=>{const n=Number(b.dataset.option);b.disabled=true;if(n===q.correct_option)b.classList.add('is-correct');else if(n===optionIndex)b.classList.add('is-wrong');});
    const feedback=document.querySelector('#lub-feedback');feedback.hidden=false;feedback.className='seiri-feedback '+(isCorrect?'feedback-correct':'feedback-wrong');
    feedback.innerHTML='<strong>'+(timedOut?'Tempo esgotado. ':isCorrect?'Resposta correta! ':'Resposta incorreta. ')+'</strong>'+esc(q.explanation);
    document.querySelector('#lub-points').textContent=(correctCount*20)+' pontos provisórios';
    document.querySelector('#lub-hint').textContent=timedOut?'A questão foi marcada como incorreta porque o tempo terminou.':'Confira a explicação antes de avançar.';
    nextBtn.disabled=false;
  }
  async function finish(){
    nextBtn.disabled=true;nextBtn.textContent='Registrando resultado…';
    const {data,error}=await supabase.rpc('submit_quiz',{p_subject_id:'lubrificacao',p_answers:answers});
    if(error){toast(error.message||'Não foi possível registrar a pontuação.',true);nextBtn.disabled=false;nextBtn.textContent='Tentar registrar novamente';return;}
    const final=Array.isArray(data)?data[0]:data;game.hidden=true;resultBox.hidden=false;
    const percent=Math.round(final.score/questions.length*100);
    resultBox.innerHTML=`<div class="seiri-result-medal">${percent===100?'🏆':percent>=60?'⭐':'📘'}</div><span class="seiri-kicker">RESULTADO · LUBRIFICAÇÃO BÁSICA</span><h2>${percent===100?'Desempenho perfeito!':percent>=60?'Bom desempenho!':'Vamos revisar?'}</h2><div class="seiri-final-stats"><div><small>Acertos</small><strong>${final.score}/${questions.length}</strong></div><div><small>Aproveitamento</small><strong>${percent}%</strong></div><div><small>Tempo</small><strong>${totalSeconds}s</strong></div></div><p>${final.is_first_attempt?'Você ganhou <b>'+final.points_awarded+' pontos</b> nesta primeira tentativa.':'Este quiz já foi concluído anteriormente; você ganhou <b>0 pontos adicionais</b>, pois somente a primeira tentativa conta.'} Pontos acumulados em Lubrificação: <b>${final.best_score}</b>.</p><p class="muted">Cada quiz soma pontos uma única vez. Refazer este quiz não aumenta o ranking.</p><div class="seiri-review"><h3>Revisão das respostas</h3>${questions.map((q,i)=>{const a=answers[i];return `<article class="seiri-review-item"><strong>${i+1}. ${esc(q.question_text)}</strong><p class="${a.selected_option===q.correct_option?'review-good':'review-bad'}">${a.selected_option===q.correct_option?'✓ Resposta correta':'✕ Resposta incorreta'} — ${esc(q.options[q.correct_option])}</p><p>${esc(q.explanation)}</p></article>`;}).join('')}</div><div class="seiri-result-actions"><button class="btn btn-primary" id="lub-retry">Tentar novamente</button><button class="btn btn-light" id="lub-dashboard">Ver ranking atualizado</button></div>`;
    document.querySelector('#lub-retry').addEventListener('click',()=>renderLubricationQuiz(box));
    document.querySelector('#lub-dashboard').addEventListener('click',dashboard);
  }
  document.querySelector('#lub-begin').addEventListener('click',()=>{start.hidden=true;game.hidden=false;loadQuestion();});
  timerBtn.addEventListener('click',startTimer);
  nextBtn.addEventListener('click',()=>{if(selected===null)return;if(index<questions.length-1){index++;loadQuestion();}else finish();});
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
async function uploadVideo(e) {
  e.preventDefault();
  const form=e.currentTarget,fd=new FormData(form),file=fd.get('file'),subjectId=fd.get('subject_id'),title=fd.get('title').toString().trim();
  if(!file||(!['video/mp4','application/mp4'].includes(file.type)&&!file.name.toLowerCase().endsWith('.mp4'))){toast('Selecione um arquivo MP4 válido.',true);return;}
  if(file.size>100*1024*1024){toast('O vídeo deve ter no máximo 100 MB.',true);return;}
  const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Enviando vídeo…';
  try {
    const safe=file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${subjectId}/${crypto.randomUUID()}-${safe}`;
    const {error:upErr}=await supabase.storage.from('training-videos').upload(path,file,{contentType:'video/mp4',upsert:false});
    if(upErr)throw upErr;
    const {error:dbErr}=await supabase.from('videos').insert({subject_id:subjectId,title,storage_path:path,uploaded_by:session.user.id,is_published:true});
    if(dbErr)throw dbErr;
    toast('Vídeo enviado e publicado.');form.reset();
  } catch(err) {toast(err.message||'Não foi possível enviar o vídeo.',true);}
  finally {btn.disabled=false;btn.textContent='Enviar vídeo';}
}

if (!configured) authView('login','Protótipo conectado à arquitetura Supabase: preencha src/config.js e aplique supabase/schema.sql para habilitar o acesso online.');
else boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', () => navigator.serviceWorker.register('/academia-industrial/sw.js').catch(err => console.warn('Falha ao registrar PWA:', err))); }
