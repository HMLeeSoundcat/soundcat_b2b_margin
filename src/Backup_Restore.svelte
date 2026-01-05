<script lang="ts">
  let { 품목목록 = $bindable() } = $props();
  import Swal from "sweetalert2";
  import { decompressFromUTF16 } from "lz-string";
  import Portal from "svelte-portal";

  let 팝업창열림여부: number | undefined = $state();
  let 팝업창: undefined | typeof Swal = $state();

  let 백업위치: number = $state(0);
  let 백업메모: string = $state("");

  let 파일선택기: HTMLInputElement | undefined = $state();
  let 업로드파일: FileList | undefined = $state();
  $inspect(업로드파일);

  let 선택된백업항목: string | undefined = $state();

  async function 복원요청작업() {
    try {
      const 요청 = await fetch("https://b2b.soundcat.com/page/product_backup.php", {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Use-Dev": import.meta.env.MODE === "development" ? "true" : "false",
        },
      });

      if (요청.ok) {
        const 결과 = await 요청.json();
        console.info(결과);
        return 결과.data;
      }
    } catch (e) {
      throw new Error(JSON.stringify(e));
    }
  }

  function 에러팝업(e: string) {
    Swal.fire({
      icon: "error",
      title: "오류가 발생했습니다.",
      text: e,
      confirmButtonText: "닫기",
    });
  }

  async function 복원동작() {
    팝업창 = Swal;
    const 팝업창결과 = await 팝업창.fire({
      icon: "question",
      html: "",
      customClass: {
        htmlContainer: "backupAndRestorePopup",
      },
      showConfirmButton: false,
      willOpen(popup) {
        백업위치 = 0;
        선택된백업항목 = undefined;
        업로드파일 = undefined;
        팝업창열림여부 = 2;
      },
      didClose() {
        팝업창열림여부 = 0;
      },
    });

    팝업창열림여부 = 0;

    if (팝업창결과.isConfirmed) {
      if (!((백업위치 == 1 && 업로드파일) || (백업위치 == 2 && 선택된백업항목)))
        return Swal.fire({
          icon: "error",
          title: "복원 위치가 지정되지 않았습니다.",
          text: "복원 위치를 선택하고 확인을 눌러주세요.",
          confirmButtonText: "확인",
          didClose() {
            팝업창열림여부 = 0;
          },
        });

      const 복원대상팝업 = await Swal.fire({
        icon: "question",
        title: "데이터 복원 대상을 선택해주세요.",
        confirmButtonText: "전체 품목 데이터 (품목명, 소비자가를 포함한 모든 데이터)",
        showDenyButton: true,
        denyButtonText: "마진 설정값만",
      });

      if (복원대상팝업.isDismissed) return;

      const 복원대상 = 복원대상팝업.isConfirmed ? "all" : "margin";

      let fetchOptions: {
        [key: string]: any;
      } = {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": import.meta.env.MODE === "development" ? "true" : "false",
        },
        body: {
          from: undefined,
          data: undefined,
        },
      };

      let fetchBody: {
        from: string | undefined;
        data: string | undefined;
        target: string;
      } = {
        from: undefined,
        data: undefined,
        target: 복원대상,
      };

      if (백업위치 == 1 && 업로드파일) {
        try {
          const fileData = URL.createObjectURL(업로드파일[0]);
          const 파일페치 = await fetch(fileData);
          const 파일데이터 = await 파일페치.text();

          const decompressed = decompressFromUTF16(파일데이터);
          console.log(decompressed);

          fetchBody.from = "local";
          const localBackup = JSON.parse(decompressed);
          if (localBackup.signature != "b2b_product_backup") return 에러팝업("올바른 백업 파일이 아닙니다.");
          fetchBody.data = localBackup.data;
        } catch (e) {
          console.error(e);
          return 에러팝업("올바른 백업 파일이 아닙니다.");
        }
      } else if (백업위치 == 2) {
        fetchBody.from = "server";
        fetchBody.data = 선택된백업항목;
      }

      if (!fetchBody.data) return 에러팝업("백업 데이터가 존재하지 않습니다.");

      fetchOptions.body = JSON.stringify(fetchBody);

      const 팝업창 = Swal;
      const 팝업띄우기 = 팝업창.fire({
        title: "복원 진행중입니다...",
        html: `백업 위치: ${fetchBody.from == "local" ? "내 컴퓨터" : "서버"}<br/>복원 대상: ${복원대상 == "all" ? "전체" : "마진만"}`,
        allowEscapeKey: false,
        allowOutsideClick: false,
        showConfirmButton: false,
      });

      let 최종결과;

      try {
        const 요청 = await fetch("https://b2b.soundcat.com/page/product_backup.php", fetchOptions);
        if (요청.ok) {
          const 결과 = await 요청.json();
          if (결과.status != "success") throw new Error("복원 과정 중 실패가 발생했습니다.");
          최종결과 = 결과.data;
          팝업창.clickConfirm();
        }
      } catch (e) {
        최종결과 = e;
        팝업창.clickDeny();
      } finally {
        const 팝업결과 = (await 팝업띄우기).isConfirmed;
        await Swal.fire({
          icon: 팝업결과 ? "success" : "error",
          title: 팝업결과 ? "작업에 성공하였습니다." : "작업에 실패하였습니다.",
          html: 팝업결과 ? "" : `<details><summary>사유</summary><code><pre>${최종결과}</pre></code></details>`,
          confirmButtonText: "닫기",
        });
        location.reload();
      }
    } else {
      if (!팝업창결과.isDenied) return;
      const 팝업창 = Swal;
      const 팝업띄우기 = 팝업창.fire({
        title: "선택된 백업 데이터를 서버에서 삭제하고 있습니다...",
        allowEscapeKey: false,
        allowOutsideClick: false,
        showConfirmButton: false,
      });

      let 최종결과;
      try {
        const 요청 = await fetch("https://b2b.soundcat.com/page/product_backup.php?no_id=" + 선택된백업항목, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Use-Dev": import.meta.env.MODE === "development" ? "true" : "false",
          },
        });
        if (요청.ok) {
          const 결과 = await 요청.json();
          if (결과.status != "success") throw new Error("백업 데이터 삭제에 실패했습니다.");
          최종결과 = 결과.data;
          팝업창.clickConfirm();
        }
      } catch (e) {
        최종결과 = e;
        팝업창.clickDeny();
      } finally {
        const 팝업결과 = (await 팝업띄우기).isConfirmed;
        await Swal.fire({
          icon: 팝업결과 ? "success" : "error",
          title: 팝업결과 ? "작업에 성공하였습니다." : "작업에 실패하였습니다.",
          html: 팝업결과 ? "" : `<details><summary>사유</summary><code><pre>${최종결과}</pre></code></details>`,
          confirmButtonText: "닫기",
        });
      }
    }
  }

  async function 백업동작() {
    const 팝업창 = await Swal.fire({
      icon: "warning",
      title: "백업은 제품 목록 관리 페이지에서만 가능합니다.",
      text: "마진 관리 페이지에서 백업을 진행할 시 일부 데이터가 누락될 가능성이 있으므로, 제품 목록 관리 페이지에서만 백업이 가능합니다. 확인을 누르시면 제품 목록 관리 페이지로 이동합니다.",
      confirmButtonText: "확인",
    });
    if (팝업창.isConfirmed) location.href = "https://b2b.soundcat.com/page/products_new.php";
  }
</script>

<button
  onclick={복원동작}
  class="button restore">복원 <i class="fas fa-upload"></i></button>
<button
  onclick={백업동작}
  class="button backup">백업 <i class="fas fa-download"></i></button>

{#if 팝업창열림여부 == 1}
  <Portal target=".backupAndRestorePopup">
    <div>
      <h3 style="margin-bottom: 1em;">백업할 위치를 선택해주세요.</h3>
      <div>
        <label
          for="backupToLocal"
          class="app_radio">
          <i></i>내 컴퓨터<input
            id="backupToLocal"
            type="radio"
            bind:group={백업위치}
            value={1} /></label>
        <label
          for="backupToServer"
          class="app_radio">
          <i></i>서버<input
            id="backupToServer"
            type="radio"
            bind:group={백업위치}
            value={2} /></label>
      </div>
      {#if 백업위치 == 2}
        <div>
          <input
            type="text"
            onkeydown={e => {
              e.key == "Enter" && 팝업창 ? 팝업창.clickConfirm() : undefined;
            }}
            bind:value={백업메모}
            placeholder="백업 메모...(선택)" />
        </div>
      {/if}
    </div>
  </Portal>
{:else if 팝업창열림여부 == 2}
  <Portal target=".backupAndRestorePopup">
    <div>
      <h3 style="margin-bottom: 1em;">어디로부터 데이터를 복원할까요?</h3>
      <div>
        <label
          for="backupToLocal"
          class="app_radio">
          <i></i>내 컴퓨터<input
            id="backupToLocal"
            type="radio"
            bind:group={백업위치}
            value={1} /></label>
        <label
          for="backupToServer"
          class="app_radio">
          <i></i>서버<input
            id="backupToServer"
            type="radio"
            bind:group={백업위치}
            value={2} /></label>
      </div>
      {#if 백업위치 == 1}
        <hr />
        <div
          role="listitem"
          onpointerup={() => {
            if (!(업로드파일 && 업로드파일.length == 1)) 파일선택기?.click();
          }}
          ondragover={e => {
            e.preventDefault();
          }}
          ondrop={e => {
            e.preventDefault();
            if (e.dataTransfer) 업로드파일 = e.dataTransfer?.files;
          }}
          class={["filednd", !(업로드파일 && 업로드파일.length == 1) && "nofile"]}>
          {#if 업로드파일 && 업로드파일[0].name}
            <div>{업로드파일[0].name}</div>
          {/if}
        </div>
        <input
          type="file"
          class="file"
          bind:this={파일선택기}
          bind:files={업로드파일} />
      {:else if 백업위치 == 2}
        <hr />
        {#await 복원요청작업()}
          <div>백업 목록을 가져오는 중입니다...</div>
        {:then 결과}
          <div>
            <div>복원할 자료를 선택해주세요.</div>
            <select
              name="backupData"
              id="backupData"
              bind:value={선택된백업항목}>
              {#each 결과.sort((a: string[], b: string[]) => parseInt(b[0]) - parseInt(a[0])) as 목록}
                <option value={목록[0]}>{목록[1]} {목록[2] && `(${목록[2]})`}</option>
              {/each}
            </select>
          </div>
        {:catch 에러}
          <div>오류가 발생하여 목록을 받아오지 못했습니다.</div>
          <div>사유</div>
          <code>
            <pre>
            {에러}
          </pre>
          </code>
        {/await}
      {/if}
      {#if 업로드파일 || 선택된백업항목}
        <div style="margin-top: 1em;">
          {#if 백업위치 == 2}
            <button
              type="button"
              class="button red"
              onclick={() => 팝업창?.clickDeny()}>삭제</button>
          {/if}
          <button
            type="button"
            class="button"
            onclick={() => 팝업창?.clickConfirm()}>다음</button>
        </div>
      {/if}
      <div style="margin-top: 1em;">
        <button
          type="button"
          class="button grey"
          onclick={() => 팝업창?.clickCancel()}>취소</button>
      </div>
    </div>
  </Portal>
{/if}

<style>
  @import "./Backup_Restore.css";
  @import "./common.css";
</style>
