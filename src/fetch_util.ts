import { get, writable, type Writable } from "svelte/store";
import * as Types from "./types";

let 브랜드: Writable<string[] | undefined> = writable([]);

let 아이디목록: Writable<Types.아이디목록타입[] | undefined> = writable([]);

const useDev = import.meta.env.MODE === "development";

export async function 품목목록가져오기() {
  브랜드.set([]);
  try {
    const 가져오기 = await fetch("https://b2b.soundcat.com/page/get_products.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Use-Dev": String(useDev),
      },
      body: JSON.stringify({
        key: "b2b_margin_setup",
      }),
    });

    if (가져오기.ok) {
      const 결과: Types.품목목록타입 = await 가져오기.json();
      브랜드.set(결과 && Object.keys(결과));
      get(브랜드)?.forEach(아이템 => {
        품목목록[아이템] = 결과[아이템].map((아이템: Types.개별품목타입) => {
          let default_margin;
          try {
            if (typeof 아이템.default_margin == "string") {
              default_margin = JSON.parse(아이템.default_margin);
              if (typeof default_margin != "object") throw new Error("마진 란이 객채가 아닙니다.");
              if (Object.keys(default_margin).length == 0) throw new Error("마진 란이 비어있습니다.");
            } else {
              throw new Error("마진 란이 비어있습니다.");
            }
          } catch (e) {
            default_margin = structuredClone(설정초기화값);
          }
          return {
            ...아이템,
            default_margin,
          };
        });
      });
      품목목록사본 = structuredClone($state.snapshot(품목목록));
      if (브랜드파라미터) 선택된브랜드 = 브랜드파라미터;
    } else {
      throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
    }
  } catch (e) {
    console.error(e);
    브랜드.set(undefined);
  }
}

export async function 아이디가져오기() {
  아이디목록 = [];
  try {
    const 가져오기 = await fetch("https://b2b.soundcat.com/page/get_members.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Use-Dev": String(useDev),
      },
      body: JSON.stringify({
        onlypartners: true,
      }),
    });

    if (가져오기.ok) {
      const 결과 = await 가져오기.json();
      아이디목록 = 결과.data;
    } else {
      throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
    }
  } catch (e) {
    console.error(e);
    아이디목록 = undefined;
  }
}

async function 상세DB가져오기() {
  if (!상세DB데이터) 상세DB데이터 = {};
  let page = 1;
  while (true) {
    try {
      const 요청 = await fetch("https://b2b.soundcat.com/bbs/board.php?bo_table=prod_db&api=json&scope=href,wr_2&page=" + page + (useDev ? "&usedev=true" : ""), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      if (요청.ok) {
        const 결과 = await 요청.json();
        if (결과.status == "success") {
          const 데이터 = 결과.data;
          for (const 항목 of 데이터) {
            if (항목["wr_2"]) {
              try {
                const 항목나열 = JSON.parse(항목["wr_2"]);
                if (Array.isArray(항목나열)) {
                  for (const element of 항목나열) {
                    상세DB데이터[element] = 항목["href"];
                  }
                }
              } catch (e) {
                상세DB데이터[항목["wr_2"]] = 항목["href"];
              }
            }
          }
          page++;
        } else {
          throw new Error("상세DB 목록 조회 실패");
        }
      } else {
        throw new Error("상세DB 서버 접속 실패");
      }
    } catch (e) {
      console.log(e);
      break;
    }
  }
}
