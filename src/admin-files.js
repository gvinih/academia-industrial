const BUCKETS = { material: 'handouts', video: 'training-videos' };

export function initAdminFiles(supabase, subjects, toast) {
  const panel = document.querySelector('.admin-panel');
  if (!panel || document.querySelector('#admin-files')) return;

  const section = document.createElement('section');
  section.id = 'admin-files';
  section.className = 'admin-files';
  section.innerHTML = `
    <div class="admin-files-heading">
      <div><div class="eyebrow">GERENCIAR ARQUIVOS</div><h3>Materiais publicados</h3>
      <p class="muted">Exclua PDFs ou vídeos enviados incorretamente.</p></div>
      <button class="btn btn-light btn-small" type="button" id="refresh-admin-files">Atualizar lista</button>
    </div>
    <div id="admin-files-list"><p class="muted">Carregando arquivos…</p></div>`;
  panel.appendChild(section);

  const style = document.createElement('style');
  style.textContent = `
    .admin-files{grid-column:1/-1;border-top:1px solid var(--border,#e5e7eb);padding-top:1.25rem;margin-top:.5rem}
    .admin-files-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    .admin-files-heading h3{margin:.25rem 0}
    .admin-file-list{display:grid;gap:.65rem;margin-top:1rem}
    .admin-file-row{display:flex;align-items:center;gap:.8rem;padding:.85rem;border:1px solid var(--border,#e5e7eb);border-radius:12px;background:var(--surface,#fff)}
    .admin-file-info{flex:1;min-width:0}
    .admin-file-info strong{display:block;overflow-wrap:anywhere}
    .admin-file-info small{display:block;color:var(--muted,#6b7280);margin-top:.2rem}
    .admin-file-kind{font-size:.72rem;font-weight:700;padding:.3rem .45rem;border-radius:6px;background:#eef2ff;color:#4338ca}
    .admin-file-delete{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}
    .admin-file-delete:hover{background:#ffe4e6}
    @media(max-width:600px){.admin-file-row{align-items:flex-start;flex-wrap:wrap}.admin-file-delete{margin-left:auto}}
  `;
  document.head.appendChild(style);

  const list = section.querySelector('#admin-files-list');
  section.querySelector('#refresh-admin-files').addEventListener('click', loadFiles);
  window.addEventListener('admin-files-changed', loadFiles);
  loadFiles();

  async function loadFiles() {
    list.innerHTML = '<p class="muted">Carregando arquivos…</p>';
    try {
      const [{data: materials, error: materialsError}, {data: videos, error: videosError}] = await Promise.all([
        supabase.from('materials').select('id,subject_id,title,storage_path,created_at').order('created_at',{ascending:false}),
        supabase.from('videos').select('id,subject_id,title,storage_path,created_at').order('created_at',{ascending:false})
      ]);
      if (materialsError) throw materialsError;
      if (videosError) throw videosError;
      const files = [
        ...(materials || []).map(file => ({...file, kind:'material', label:'PDF', bucket:BUCKETS.material})),
        ...(videos || []).map(file => ({...file, kind:'video', label:'VÍDEO', bucket:BUCKETS.video}))
      ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

      if (!files.length) {
        list.innerHTML = '<div class="empty-state">Nenhum arquivo publicado ainda.</div>';
        return;
      }
      list.innerHTML = '<div class="admin-file-list">' + files.map(file => {
        const subject = subjects.find(s => s.id === file.subject_id)?.name || file.subject_id;
        const date = file.created_at ? new Date(file.created_at).toLocaleDateString('pt-BR') : '';
        return `<div class="admin-file-row">
          <span class="admin-file-kind">${file.label}</span>
          <div class="admin-file-info"><strong>${escapeHtml(file.title)}</strong><small>${escapeHtml(subject)} · Enviado em ${date}</small></div>
          <button class="btn btn-small admin-file-delete" type="button" data-delete-kind="${file.kind}" data-delete-id="${file.id}" data-delete-path="${escapeHtml(file.storage_path)}" data-delete-title="${escapeHtml(file.title)}">Excluir arquivo</button>
        </div>`;
      }).join('') + '</div>';

      list.querySelectorAll('[data-delete-id]').forEach(button => {
        button.addEventListener('click', () => deleteFile(button));
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<p class="muted">Não foi possível carregar a lista. Confira as permissões de administrador e as políticas do Supabase.</p>';
    }
  }

  async function deleteFile(button) {
    const title = button.dataset.deleteTitle || 'este arquivo';
    if (!window.confirm(`Tem certeza que deseja excluir "${title}"? Essa ação não pode ser desfeita.`)) return;
    const kind = button.dataset.deleteKind;
    const id = button.dataset.deleteId;
    const path = button.dataset.deletePath;
    const table = kind === 'video' ? 'videos' : 'materials';
    button.disabled = true;
    button.textContent = 'Excluindo…';
    try {
      const {error: storageError} = await supabase.storage.from(BUCKETS[kind]).remove([path]);
      if (storageError) throw storageError;
      const {error: dbError} = await supabase.from(table).delete().eq('id', id);
      if (dbError) throw dbError;
      toast('Arquivo excluído com sucesso.');
      await loadFiles();
      window.dispatchEvent(new Event('admin-files-changed'));
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível excluir o arquivo. Confira as permissões do Supabase.', true);
      button.disabled = false;
      button.textContent = 'Excluir arquivo';
    }
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
