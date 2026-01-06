<script lang="ts">
  import { onMount } from "svelte";
  import Portal from "svelte-portal";
  import Swal from "sweetalert2";
  import * as Types from "./types";
  import { fly, scale } from "svelte/transition";

  interface 확장된아이디목록 extends Types.아이디목록타입 {
    selected?: boolean;
  }

  interface Props {
    앱요소: HTMLElement | undefined;
    선택된브랜드: string | undefined;
    아이디목록: 확장된아이디목록[];
    아이디목록캐싱: { [key: Types.아이디목록타입["mb_id"]]: Types.아이디목록타입["mb_nick"] };
    마진그룹: Types.마진그룹타입;
    마진설정보기팝업: HTMLElement | undefined;
    마진설정보기활성화: boolean;
    현재마진탭: string | undefined;
  }

  const useDev = import.meta.env.MODE === "development";

  let { 앱요소, 선택된브랜드, 아이디목록, 아이디목록캐싱, 마진그룹 = $bindable(), 마진설정보기팝업 = $bindable(), 마진설정보기활성화 = $bindable(), 현재마진탭 = $bindable() } = $props();

  let 마진그룹아이디목록 = $derived(아이디목록);

  let 팝업창내용: { html: HTMLElement | undefined | null; label: string | undefined; useInput: boolean } = $state({
    html: undefined,
    label: undefined,
    useInput: true,
  });

  let swal: typeof Swal | undefined = $state();

  let groupMenu: {
    active: boolean;
    top: number;
    left: number;
    element: HTMLElement | undefined;
    item?: Types.브랜드별마진그룹타입;
  } = $state({
    active: false,
    top: 0,
    left: 0,
    element: undefined,
  });

  let 기본마진목록: HTMLElement | undefined = $state();
  let 기타마진목록: HTMLElement | undefined = $state();

  async function 마진그룹가져오기() {
    마진그룹 = {};
    try {
      const 가져오기 = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": String(useDev),
        },
      });

      if (!가져오기.ok) throw new Error("서버 접속 실패." + JSON.stringify(가져오기));

      const 결과: { [key: string]: any; data: Types.마진그룹타입 } = await 가져오기.json();
      if (결과.status != "success") throw new Error("서버 작업 실패." + JSON.stringify(결과));
      마진그룹 = 결과.data;
    } catch (e) {
      console.error(e);
      마진그룹 = {};
    }
  }

  async function 새마진그룹(e: UIEvent) {
    swal = Swal;
    const popup = swal.fire({
      title: `<code>${선택된브랜드}</code> 브랜드에 새 마진 그룹 추가`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify({
          label: 팝업창내용.label,
          brand: 선택된브랜드,
        }),
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "마진 그룹이 추가되었습니다.",
        });
      마진그룹가져오기();
    } catch (e) {
      console.error((e as Error).message);
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      swal = undefined;
    }
  }

  async function 그룹명편집(현재그룹명: string | undefined, uuid: string | undefined) {
    if (!(현재그룹명 && uuid)) return;
    groupMenu.active = false;

    swal = Swal;
    const popup = swal.fire({
      title: `"<code>${현재그룹명}</code>" 그룹명 변경`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?action=label", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify({
          uuid,
          label: 팝업창내용.label,
          brand: 선택된브랜드,
        }),
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "그룹명이 변경되었습니다.",
        });
      마진그룹가져오기();
    } catch (e) {
      console.error((e as Error).message);
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      swal = undefined;
    }
  }

  async function 그룹삭제(현재그룹명: string | undefined, uuid: string | undefined) {
    if (!(현재그룹명 && uuid)) return;
    groupMenu.active = false;

    swal = Swal;
    const popup = swal.fire({
      title: `"<code>${현재그룹명}</code>" 그룹을 삭제하시겠습니까?`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.useInput = false;
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?uuid=" + uuid, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "그룹이 삭제되었습니다.",
        });
      마진그룹가져오기();
    } catch (e) {
      console.error((e as Error).message);
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      팝업창내용.useInput = true;
      swal = undefined;
    }
  }

  function 마진목록에서드래그작업(e: Event) {
    // e.preventDefault();
    console.log(e);
  }

  onMount(async () => {
    await 마진그룹가져오기();
  });
</script>

<svelte:window
  onpointerdown={(e) => {
    if (groupMenu.active && groupMenu.element && e.target instanceof HTMLElement && !groupMenu.element.contains(e.target)) groupMenu.active = false;
  }} />
<ul class="app-groups">
  <li><button aria-label="마진 설정 보기" title="마진 설정 보기" onclick={() => (마진설정보기활성화 = true)}><i class="far fa-window-restore"></i></button></li>
  <div class="gap"></div>
  {#if 선택된브랜드}
    <li class={[(현재마진탭 == "default" || 현재마진탭 == undefined) && "active"]}>
      <a href="#default" onclick={() => (현재마진탭 = undefined)}>기본마진</a>
    </li>
    {#each 마진그룹[선택된브랜드] as 마진탭 (마진탭.uuid)}
      <li class={[현재마진탭 == 마진탭.uuid && "active"]}>
        <a href="#{마진탭.uuid}" onclick={() => (현재마진탭 = 마진탭.uuid)}>
          {마진탭.label}
          <button
            class="group-menu-btn"
            aria-label="그룹 메뉴"
            onclick={(e) => {
              if (!앱요소) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const 앱요소의크기 = 앱요소.getBoundingClientRect();
              groupMenu.top = rect.y - 앱요소의크기.y;
              groupMenu.left = rect.x - 앱요소의크기.x;
              groupMenu.active = true;
              groupMenu.item = 마진탭;
            }}><i class="fas fa-ellipsis-v"></i></button>
        </a>
      </li>
    {/each}
  {/if}
  <li class={[현재마진탭 == "etc" && "active"]}>
    <a href="#etc" onclick={() => (현재마진탭 = "etc")}>기타</a>
  </li>
  <li>
    <button onclick={새마진그룹}>+</button>
  </li>
  <li>
    <button aria-label="도움말"><i class="fas fa-question-circle"></i></button>
  </li>
</ul>
{#if groupMenu.active}
  <div
    bind:this={groupMenu.element}
    class="group-menu"
    style="top: {groupMenu.top}px; left: {groupMenu.left}px;"
    transition:fly={{ y: -10, duration: 200 }}
    {@attach () => {
      return () => {
        groupMenu.element = undefined;
        groupMenu.item = undefined;
      };
    }}>
    <button onclick={() => 그룹명편집(groupMenu.item?.label, groupMenu.item?.uuid)}>마진 그룹명 변경</button>
    <button onclick={() => 그룹삭제(groupMenu.item?.label, groupMenu.item?.uuid)}>마진 그룹 삭제</button>
  </div>
{/if}
{#if 팝업창내용.html}
  <Portal target={팝업창내용.html}>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        if (swal) swal.clickConfirm();
      }}
      class="popup">
      {#if 팝업창내용.useInput}
        <label>
          <span class="text-within-label">그룹 이름: </span>
          <input type="text" bind:value={팝업창내용.label} required />
        </label>
      {/if}
      <div style="margin-top: 1em;">
        <button class="button" type="submit">확인</button>
      </div>
    </form>
  </Portal>
{/if}
{#if 마진설정보기활성화}
  <Portal target="body">
    <div class="margin-popup-window">
      <div class="inner" bind:this={마진설정보기팝업} transition:scale={{ opacity: 0, start: 0.99, duration: 200 }}>
        <h2 class="title">{선택된브랜드} 브랜드 마진그룹</h2>
        <div class="select-section">
          <div class="selection-group">
            <div class="group-title">기본마진</div>
            <div role="listbox" aria-multiselectable="true" tabindex="0" id="default" bind:this={기본마진목록} ondrag={마진목록에서드래그작업}>
              {#each 아이디목록 as 아이디}
                <div class:selected={아이디.selected} role="option" tabindex="0" aria-selected="false" draggable="true" data-value={아이디.mb_id} onpointerdown={() => (아이디.selected = true)}>{아이디.mb_nick}</div>
              {/each}
            </div>
          </div>
          {#each 마진그룹[선택된브랜드] as 마진탭 (마진탭.uuid)}
            <div class="selection-group">
              <div class="group-title">{마진탭.label}</div>
              <div role="listbox" aria-multiselectable="true" tabindex="0" id={마진탭.uuid} bind:this={마진탭.element} ondragstart={마진목록에서드래그작업}>
                <div role="option" tabindex="0" aria-selected="false" draggable data-value="">하나선택</div>
              </div>
            </div>
          {/each}
          <div class="selection-group">
            <div class="group-title">기타</div>
            <div role="listbox" aria-multiselectable="true" tabindex="0" id="etc" bind:this={기타마진목록} ondragstart={마진목록에서드래그작업}>
              <div role="option" tabindex="0" aria-selected="false" draggable data-value="">하나선택</div>
            </div>
          </div>
        </div>
        <button class="close" aria-label="창닫기" title="창닫기" onclick={() => (마진설정보기활성화 = false)}><i class="fas fa-times"></i></button>
      </div>
    </div>
  </Portal>
{/if}

<style>
  @import "./common.css";
  @import "./Margin_Groups.css";
</style>
