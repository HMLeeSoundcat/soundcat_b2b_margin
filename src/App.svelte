<script lang="ts">
  import TomSelect from "tom-select";
  import "tom-select/dist/css/tom-select.css";
  import Swal from 'sweetalert2';
  import Sidebar from "./sidebar.svelte";
  import { onMount } from "svelte";

  interface 개별품목타입 {
    no_id: number,
    brand: string,
    PROD_CD: string,
    product: string,
    hidden: number,
    stock: number,
    soldout: number,
    price: number,
    default_margin: string|마진타입
  }

  interface 품목목록타입 {
    [key: string]: 개별품목타입[]
  }

  interface 마진타입 {
    default_margin: number|string|undefined,
    default_prov: number|string|undefined,
    discount_qty: number|string|undefined,
    brand_disc_amount: number|string|undefined,
    discount_margin: number|string|undefined,
    discount_price: number|string|undefined,
    per_user: {
      [key: string]: {
        discount_margin: number|string|undefined,
        discount_price: number|string|undefined,
      }
    }
  }

  let 품목목록:품목목록타입 = $state({});

  let 브랜드:string[]|undefined = $state();

  let 선택된브랜드:string|undefined = $state();
  let 선택된브랜드품목 = $derived(선택된브랜드?품목목록&&품목목록[선택된브랜드]:undefined);

  interface 아이디목록타입 {
    "mb_no": string,
    "mb_id": string,
    "mb_nick": string,
    "mb_8": string
  }

  let 아이디목록:아이디목록타입[]|undefined = $state();

  let 아이디입력상자:HTMLSelectElement|undefined = $state();
  let 아이디선택상자 = $derived.by(()=>{
    if (!(아이디입력상자 && 아이디목록)) return;
    return new TomSelect(아이디입력상자,{
        valueField: "mb_id",
        labelField: "mb_nick",
        searchField: ['mb_id','mb_nick'],
        plugins: {
          remove_button:{
			      title:'항목 삭제',
		      }
        },
        placeholder: "아이디 선택...",
        onChange: (value: string[])=>선택된아이디=value,
        maxOptions: undefined,

    });
  });

  let 선택된아이디: string[] = $state([]);

  interface 품목테이블컬럼속성타입 {
    [key: string]: {
      width: string,
      display: boolean,
      label: string
    }
  }
  
  let 품목테이블컬럼속성:품목테이블컬럼속성타입 = $derived({
    no_id: {width: '0%', display: false, label: ''},
    품목명: {width: '40%', display: true, label: '품목명'},
    기본마진: {width: '10%', display: true, label: '기본 마진'},
    기본공급가: {width: '10%', display: true, label: '기본 공급가'},
    할인수량: {width: '10%', display: true, label: '할인 수량'},
    할인마진: {width: '10%', display: true, label: (선택된아이디.length == 0?'기본 ':'업체별 ') + '할인 마진'},
    할인공급가: {width: '10%', display: true, label: (선택된아이디.length == 0?'기본 ':'업체별 ') + '할인 공급가'},
    브랜드할인최소액: {width: '10%', display: true, label: '브랜드 할인 최소액'}
  });

  let 브랜드일괄편집필드:Omit<마진타입, 'per_user'> = $state({
    default_margin: undefined,
    default_prov: undefined,
    discount_qty: undefined,
    discount_margin: undefined,
    discount_price: undefined,
    brand_disc_amount: undefined
  });

  async function 품목목록가져오기 () {
      try {
          const 가져오기 = await fetch('https://b2b.soundcat.com/page/get_products.php',{
              "method": "POST",
              "headers": {
                  "Content-Type": "application/json"
              },
              "body": JSON.stringify({
                  "key": "b2b_margin_setup"
              })
          });

          if (가져오기.ok) {
              const 결과:품목목록타입 = await 가져오기.json();
              브랜드 = 결과&&Object.keys(결과);
              브랜드.forEach(아이템 => {
                품목목록[아이템] = 결과[아이템].map((아이템: 개별품목타입)=>{
                  let default_margin;
                  try {
                    if (typeof 아이템.default_margin == 'string') {
                      default_margin = JSON.parse(아이템.default_margin);

                      if (typeof default_margin != 'object') throw new Error('마진 란이 객채가 아닙니다.');
                    } else {
                      throw new Error('마진 란이 비어있습니다.');
                    }
                  } catch (e) {
                    // console.error(e);
                    default_margin = {
                      default_margin: 0,
                      default_prov: 0,
                      discount_qty: 0,
                      discount_margin: 0,
                      discount_price: 0,
                      brand_disc_amount: 0,
                      per_user: {}
                    };
                  }
                  return {
                    ...아이템,
                    default_margin
                  }
                })
              });
          } else {
              throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
          }
      } catch (e) {
          console.error(e);
      }
    }
    
    async function 아이디가져오기 () {
    try {
        const 가져오기 = await fetch('https://b2b.soundcat.com/page/get_members.php',{
            "method": "POST",
            "headers": {
                "Content-Type": "application/json",
                "Use-Dev": "true"
            },
            "body": JSON.stringify({
              "onlypartners": true
            })
        });

        if (가져오기.ok) {
            const 결과 = await 가져오기.json();
            아이디목록 = 결과;
        } else {
            throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
        }
    } catch (e) {
        console.error(e);
    }
  }

  function 유저별엔트리생성 (품목: 개별품목타입, 아이디: string) {
    if (typeof 품목.default_margin != 'object') return;

    if (!품목.default_margin.per_user?.[아이디]) 품목.default_margin.per_user[아이디] = {
      discount_margin: -1,
      discount_price: -1
    }
  }

  function 할인마진겟터 (품목: 개별품목타입) {
    if (typeof 품목.default_margin != 'object') return;
    if (선택된아이디.length == 0) {
      return 로케일숫자로표시(품목.default_margin.discount_margin);
    } else if (선택된아이디.length == 1) {
      return 로케일숫자로표시(품목.default_margin.per_user?.[선택된아이디[0]]?.discount_margin);
    } else {
      const 첫번째아이디값 = 선택된아이디.length?품목.default_margin.per_user?.[선택된아이디[0]]?.discount_margin:undefined;
      for (const 각아이디 of 선택된아이디) {
        if (첫번째아이디값 != 품목.default_margin.per_user?.[각아이디]?.discount_margin) return undefined;
      }
      return 로케일숫자로표시(첫번째아이디값);
    }
  }
  
  function 할인공급가겟터 (품목: 개별품목타입) {
    if (typeof 품목.default_margin != 'object') return;
    if (선택된아이디.length == 0) {
      return 로케일숫자로표시(품목.default_margin.discount_price);
    } else if (선택된아이디.length == 1) {
      return 로케일숫자로표시(품목.default_margin.per_user?.[선택된아이디[0]]?.discount_price);
    } else {
      const 첫번째아이디값 = 선택된아이디.length?품목.default_margin.per_user?.[선택된아이디[0]]?.discount_price:undefined;
      for (const 각아이디 of 선택된아이디) {
        if (첫번째아이디값 != 품목.default_margin.per_user?.[각아이디]?.discount_price) return undefined;
      }
      return 로케일숫자로표시(첫번째아이디값);
    }
  }

  function 할인마진셋터 (v:string|number|undefined, 품목: 개별품목타입|개별품목타입[]) {
    const 세팅할품목 = Array.isArray(품목)?품목:[품목];
    
    세팅할품목.forEach(품목 => {      
      if (typeof 품목.default_margin != 'object') return;
      if (선택된아이디.length == 0) {
        품목.default_margin.discount_margin = 숫자로변환(v??품목.default_margin.default_margin);
      } else if (선택된아이디.length == 1) {
        유저별엔트리생성(품목, 선택된아이디[0]);
        품목.default_margin.per_user[선택된아이디[0]].discount_margin = 숫자로변환(v??품목.default_margin.default_margin);
      } else {
        선택된아이디.forEach(element => {
          if (typeof 품목.default_margin != 'object') return;
          유저별엔트리생성(품목, element);
          품목.default_margin.per_user[element].discount_margin = 숫자로변환(v??품목.default_margin.default_margin);
        });
      }
    });
  }



  function 할인공급가셋터 (v:string|number|undefined, 품목: 개별품목타입|개별품목타입[]) {
    const 세팅할품목 = Array.isArray(품목)?품목:[품목];

    세팅할품목.forEach(품목 => {
      if (typeof 품목.default_margin != 'object') return;
      if (선택된아이디.length == 0) {
        품목.default_margin.discount_price = 숫자로변환(v??품목.default_margin.default_margin);
      } else if (선택된아이디.length == 1) {
        유저별엔트리생성(품목, 선택된아이디[0]);
        품목.default_margin.per_user[선택된아이디[0]].discount_price = 숫자로변환(v??품목.default_margin.default_prov);
      } else {
        선택된아이디.forEach(element => {
          if (typeof 품목.default_margin != 'object') return;
          유저별엔트리생성(품목, element);
          품목.default_margin.per_user[element].discount_price = 숫자로변환(v??품목.default_margin.default_prov);
        });
      }
    });
  }

  function 숫자로변환 (값: string|number|undefined) {
    if (!값) return 0;
    const 반환할값 = String(값).replace(/[^0-9.]/g,'').replace(/\.\.+/g,'.')||'0';
    const 파싱한값 = parseFloat(반환할값);
    return (반환할값.match(/\./g) || []).length == 1 && 반환할값.endsWith('.')?반환할값:파싱한값;
  }
  
  function 로케일숫자로표시 (값: string|number|undefined) {
    if (!값) return 0;
    return String(값).endsWith('.')?값:Intl.NumberFormat('ko-KR').format(parseFloat(String(값)));
  }

  function 브랜드값일괄편집<Target extends Exclude<keyof 마진타입, 'per_user'>>(값: string|number, 타겟: Target) {
    선택된브랜드품목?.forEach((품목)=>{
      (품목.default_margin as 마진타입)[타겟] = 숫자로변환(값);
    })
  }

  onMount(async ()=>{
      품목목록가져오기();
      await 아이디가져오기();
  });

  $effect(()=>{
    if (아이디선택상자 && 아이디목록) {
      아이디선택상자.addOptions(아이디목록);
    }
  });

  $effect(()=>{
    if (선택된브랜드) 브랜드일괄편집필드 = {
      default_margin: undefined,
      default_prov: undefined,
      discount_qty: undefined,
      discount_margin: undefined,
      discount_price: undefined,
      brand_disc_amount: undefined
    }
  });
  $effect(()=>{
    if (선택된아이디) 브랜드일괄편집필드 = {
      default_margin: undefined,
      default_prov: undefined,
      discount_qty: undefined,
      discount_margin: undefined,
      discount_price: undefined,
      brand_disc_amount: undefined
    }
  });
</script>
<section class="app-section">
  <Sidebar 브랜드={브랜드} bind:선택된브랜드={선택된브랜드} />
  <div class="app-toolbar">
    <div class="app-user-select-container"><select multiple class="app-user-select" bind:this={아이디입력상자}></select></div>
    <div class="app-submit-div">
      <button type="button" class="cancel"><i class="fas fa-redo"></i> 변경 취소</button>
      <button type="button" class="submit"><i class="fas fa-check"></i> 저장</button>
    </div>
  </div>
  {#if 선택된브랜드 && 선택된브랜드품목}
  <div class="app-table-container">
    <table class="app-table">
      <colgroup>
        {#each Object.keys(품목테이블컬럼속성) as 컬럼명}
        {#if 품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].display}
        <col width={품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].width}/>
        {/if}
        {/each}
      </colgroup>
      <thead>
        <tr>
          {#each Object.keys(품목테이블컬럼속성) as 컬럼명}
          {#if 품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].display}
          <th><div><span>{품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].label}</span></div></th>
          {/if}
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><div><span><b>{선택된브랜드} 브랜드 전체 수정</b></span></div></td>
          <td><div><input type="text" onchange={(e)=>브랜드값일괄편집(e.currentTarget.value, 'default_margin')} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.default_margin),(v)=>{브랜드일괄편집필드.default_margin = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" onchange={(e)=>브랜드값일괄편집(e.currentTarget.value, 'default_prov')} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.default_prov),(v)=>{브랜드일괄편집필드.default_prov = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" onchange={(e)=>브랜드값일괄편집(e.currentTarget.value, 'discount_qty')} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.discount_qty),(v)=>{브랜드일괄편집필드.discount_qty = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" onchange={(e)=>할인마진셋터(e.currentTarget.value,선택된브랜드품목)} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.discount_margin),(v)=>{브랜드일괄편집필드.discount_margin = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" onchange={(e)=>할인공급가셋터(e.currentTarget.value,선택된브랜드품목)} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.discount_price),(v)=>{브랜드일괄편집필드.discount_price = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" onchange={(e)=>브랜드값일괄편집(e.currentTarget.value, 'brand_disc_amount')} bind:value={()=>로케일숫자로표시(브랜드일괄편집필드.brand_disc_amount),(v)=>{브랜드일괄편집필드.brand_disc_amount = 숫자로변환(v)}}></div></td>
        </tr>
        {#each 선택된브랜드품목 as 품목}
        <tr>
          <td><div><span>{품목.product}</span></div></td>
          {#if typeof 품목.default_margin == 'object'}
          <td><div><input type="text" bind:value={()=>로케일숫자로표시((품목.default_margin as 마진타입).default_margin),(v)=>{(품목.default_margin as 마진타입).default_margin = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" bind:value={()=>로케일숫자로표시((품목.default_margin as 마진타입).default_prov),(v)=>{(품목.default_margin as 마진타입).default_prov = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" bind:value={()=>로케일숫자로표시((품목.default_margin as 마진타입).discount_qty),(v)=>{(품목.default_margin as 마진타입).discount_qty = 숫자로변환(v)}}></div></td>
          <td><div><input type="text" bind:value={()=>할인마진겟터(품목),(v)=>{할인마진셋터(v,품목)}}></div></td>
          <td><div><input type="text" bind:value={()=>할인공급가겟터(품목),(v)=>{할인공급가셋터(v,품목)}}></div></td>
          <td><div><input type="text" bind:value={()=>로케일숫자로표시((품목.default_margin as 마진타입).brand_disc_amount),(v)=>{(품목.default_margin as 마진타입).brand_disc_amount = 숫자로변환(v)}}></div></td>
          {/if}
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</section>
<style>
  .app-section {
    position: relative;
  }
  .app-toolbar {
    display: flex;
    gap: 1em;
  }
  .app-user-select-container {
    flex-grow: 1;
  }
  .app-submit-div button {
    border: none;
    border-radius: 5px;
    font-size: 1em;
    padding: 0.5em 1em;
    background: #eee;
    box-shadow: 0 2px 4px #0003;
  }
  .app-submit-div :is(button:hover,button:focus) {
    filter: brightness(1.1);
  }
  .app-submit-div button:active {
    filter: brightness(1);
    transform: translateY(1px);
  }
  .app-submit-div button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  .app-submit-div button.cancel {
    background: rgb(179, 34, 34);
    color: white;
  }
  .app-submit-div button.submit {
    background: rgb(20, 185, 20);
    color: white;
  }
  .app-table-container {
    margin-top: 1em;
  }
  .app-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }
  .app-table thead {
    background: #eee;
  }
  .app-table tr {
    border-bottom: 1px solid #ddd;
  }
  .app-table :is(th,td) {
    height: 1em;
  }
  .app-table :is(th,td) div {
    padding: 1em;
  }
  .app-table :is(th,td) span {
    padding: 0.5em;
  }
  .app-table td input[type="text"] {
    width: 100%;
    display: block;
    font-size: 1em;
    padding: 0.5em;
    border: none;
    outline: none;
    border-bottom: 2px solid #eee;
    transition: border 0.2s, background-color 0.2s;
  }
  .app-table td input[type="text"]:hover {
    border-color: #ccc;
    background-color: #f4f4f4;
  }
  .app-table td input[type="text"]:focus {
    border-color: rgb(10,127,251);
    transition: border 0s;
  }
</style>
