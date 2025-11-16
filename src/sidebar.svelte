<script lang="ts">
let { 브랜드, 선택된브랜드 = $bindable() } = $props();
let 사이드바:HTMLElement|undefined = $state();

let 사이드바열림 = $state(false);

$effect(()=>{
    if (선택된브랜드) 사이드바열림 = false;
})

</script>
<svelte:window onpointerdown={(e)=>{if (!사이드바?.contains(e?.target as HTMLElement)) 사이드바열림 = false}} />
<div class={["app-sidebars",사이드바열림&&"opened"]}>
    <aside class={["app-sidebar"]} bind:this={사이드바}>
        <nav>
            <ul>
                {#each 브랜드 as 각브랜드}
                <li><button class={[선택된브랜드==각브랜드&&"active"]} onclick={()=>선택된브랜드=각브랜드}>{각브랜드}</button></li>
                {/each}
            </ul>
        </nav>
    </aside>
    <button aria-label="브랜드 {사이드바열림?"닫기":"보기"}" class={[사이드바열림&&"opened", "app-sidebar-btn"]} onclick={()=>사이드바열림=!사이드바열림}>
        <i class={[`fas fa-angle-double-${사이드바열림?"left":"right"}`]}></i>
    </button>
</div>
<style>
    .app-sidebars {
        position: fixed;
        top: 0;
        left: calc(min(200px, 80vw) * -1);
        height: 100vh;
        display: flex;
        align-items: center;
        transition: .2s;
        pointer-events: none;
        z-index:999;
    }
    .app-sidebars.opened {
        left: 0;
    }
    aside {
        display: block;
        width: min(200px, 80vw);
        height: 100vh;
        border-right: 1px solid #ddd;
        padding: 0.5em;
        overflow-y: auto;
        pointer-events: all;
        background: white;
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        padding: 0.1em 0;
    }
    li button {
        border: 1px solid transparent;
        padding: 0.7em 1em;
        background: none;
        margin: 0;
        display: block;
        font-size: 1em;
        border-radius: 0.5em;
        width: 100%;
        text-align: left;
        color: black;
    }
    li button:hover, li button:focus {
        border-color: rgb(10,127,251);
    }
    li button:active, li button.active {
        background: rgb(10,127,251);
        color: white;
    }

    .app-sidebar-btn {
      border: 1px solid #ddd;
      border-left: none!important;
      background: #eee;
      padding: 1em;
      border-radius: 0 1em 1em 0;
      font-size: 1em;
      transition: .2s;
      opacity: 0.5;
      pointer-events: all;
    }
    .app-sidebar-btn.opened {
        opacity: 1;
    }
    .app-sidebar-btn:hover {
      background: #ddd;
      opacity: 1;
    }
    .app-sidebar-btn:active {
      background: #ccc;
    }
    .app-sidebar-btn:focus {
      border: 1px solid #ccc;
      opacity: 1;
    }
</style>