<script lang="ts">
  let { 브랜드, 선택된브랜드 = $bindable(), 품목목록가져오기 } = $props();
  let 사이드바: HTMLElement | undefined = $state();

  let 사이드바열림 = $state(false);

  $effect(() => {
    if (선택된브랜드) 사이드바열림 = false;
  });
</script>

<svelte:window
  onpointerdown={e => {
    if (!사이드바?.contains(e?.target as HTMLElement)) 사이드바열림 = false;
  }} />
<div class={["app-sidebars", 사이드바열림 && "opened"]}>
  <aside
    class={["app-sidebar"]}
    bind:this={사이드바}>
    <nav>
      {#if 브랜드 && 브랜드.length}
        <ul>
          {#each 브랜드 as 각브랜드}
            <li>
              <button
                class={[선택된브랜드 == 각브랜드 && "active"]}
                onclick={() => (선택된브랜드 = 각브랜드)}>{각브랜드}</button>
            </li>
          {/each}
        </ul>
      {:else if 브랜드}
        <div class="loading">브랜드 목록을 가져오고 있습니다...</div>
      {:else}
        <div class="failed">
          <p>브랜드 목록 가져오기를 실패했습니다. 재시도하시겠습니까?</p>
          <p>
            <button
              class="retry-btn"
              onclick={() => 품목목록가져오기()}><i class="fas fa-redo"></i> 재시도</button>
          </p>
        </div>
      {/if}
    </nav>
  </aside>
  <button
    aria-label="브랜드 {사이드바열림 ? '닫기' : '보기'}"
    class={[사이드바열림 && "opened", "app-sidebar-btn", !선택된브랜드 && "nobrand"]}
    onclick={() => (사이드바열림 = !사이드바열림)}>
    <i class={[`fas fa-angle-double-${사이드바열림 ? "left" : "right"}`]}></i>
  </button>
</div>

<style>
  @import "./sidebar.css";
</style>
