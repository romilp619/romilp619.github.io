(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  if (window.location.hash === '#vapt-lab') {
    history.replaceState(null, '', '#vapt-ops');
  }

  const updateRepoIntel = async () => {
    const nodes = $$('.repo-intel[data-repo]');
    await Promise.all(nodes.map(async (node) => {
      const repo = node.dataset.repo;
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
        if (!response.ok) throw new Error('GitHub unavailable');
        const data = await response.json();
        const updated = data.pushed_at ? new Date(data.pushed_at).toISOString().slice(0, 10) : 'PUBLIC';
        node.textContent = `GITHUB / ★ ${data.stargazers_count || 0} / UPDATED ${updated}`;
        node.classList.add('live');
      } catch {
        node.textContent = 'GITHUB / PUBLIC REPO';
      }
    }));
  };

  const initCredentialVault = () => {
    const search = $('#credential-search');
    const count = $('#credential-count');
    const filterButtons = $$('.credential-filters button');
    const cards = $$('#credentials .credential-featured article, #credentials .credential-list article');
    if (!search || !count || !cards.length) return;

    let active = 'all';
    const categorize = (card) => {
      const explicit = card.dataset.category;
      if (explicit) return explicit.toLowerCase();
      const text = card.textContent.toLowerCase();
      if (/azure|oracle|cloud/.test(text)) return 'cloud';
      if (/ai|machine|ml/.test(text)) return 'ai';
      if (/python|java|c\+\+|software|code/.test(text)) return 'code';
      return 'cyber';
    };

    const apply = () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const category = categorize(card);
        const matchCategory = active === 'all' || category === active;
        const matchSearch = !query || card.textContent.toLowerCase().includes(query);
        const show = matchCategory && matchSearch;
        card.hidden = !show;
        if (show) visible += 1;
      });
      count.textContent = `${visible} credential${visible === 1 ? '' : 's'} visible`;
      filterButtons.forEach((button) => button.classList.toggle('active', button.dataset.filter === active));
    };

    search.addEventListener('input', apply);
    filterButtons.forEach((button) => button.addEventListener('click', () => {
      active = button.dataset.filter;
      apply();
    }));
    apply();
  };

  const initDialogs = () => {
    const recruiter = $('#recruiter-dialog');
    const ctf = $('#ctf-challenge');
    const openRecruiter = () => recruiter?.showModal();
    const openCtf = () => ctf?.showModal();

    $('#recruiter-toggle')?.addEventListener('click', openRecruiter);
    $('[data-close-recruiter]')?.addEventListener('click', () => recruiter?.close());
    $$('.ctf-trigger').forEach((button) => button.addEventListener('click', openCtf));

    const answer = $('#ctf-answer');
    const result = $('#ctf-result');
    $('#ctf-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const normalized = answer.value.trim().toLowerCase();
      if (normalized === 'x-frame-options') {
        localStorage.setItem('romil-ctf-solved', '1');
        $('#operator-badge')?.removeAttribute('hidden');
        result.textContent = 'Badge unlocked: operator verified.';
        result.className = 'ctf-result success';
      } else {
        result.textContent = 'Not yet. Hint: legacy clickjacking defence header.';
        result.className = 'ctf-result error';
      }
    });

    if (localStorage.getItem('romil-ctf-solved') === '1') $('#operator-badge')?.removeAttribute('hidden');
    return { openRecruiter, openCtf };
  };

  const initCommandPalette = ({ openRecruiter, openCtf }) => {
    const palette = $('.command-palette');
    if (!palette) return;
    const input = $('.command-input', palette);
    const results = $$('.palette-results > *', palette);
    if (!input || !results.length) return;

    const close = () => {
      if (palette.open) palette.close();
      input.value = '';
      results.forEach((item) => item.hidden = false);
    };
    const run = (item) => {
      const command = item.dataset.command || '';
      if (command.includes('recruiter')) openRecruiter();
      else if (command.includes('ctf')) openCtf();
      else if (item.matches('a')) window.location.href = item.getAttribute('href');
      close();
    };
    const filter = () => {
      const query = input.value.trim().toLowerCase();
      results.forEach((item) => {
        item.hidden = query && !`${item.dataset.command} ${item.textContent}`.toLowerCase().includes(query);
      });
    };

    document.addEventListener('keydown', () => {
      requestAnimationFrame(() => { if (palette.open) input.focus(); });
    });
    input.addEventListener('input', filter);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const first = results.find((item) => !item.hidden);
      if (first) run(first);
    });
    results.forEach((item) => item.addEventListener('click', (event) => {
      if (item.matches('button')) {
        event.preventDefault();
        run(item);
      }
    }));
  };

  const dialogs = initDialogs();
  initCredentialVault();
  initCommandPalette(dialogs);
  updateRepoIntel();
})();
