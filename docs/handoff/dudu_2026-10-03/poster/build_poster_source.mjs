import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = process.env.POSTER_TEMPLATE;
const workspaceDir = process.env.POSTER_WORKSPACE;
const skillDir = process.env.SKILL_DIR;
const pythonExecutable = process.env.RUNTIME_PYTHON;
if (![sourcePath, workspaceDir, skillDir, pythonExecutable].every(Boolean)) {
  throw new Error("Missing required paths");
}

const buildDir = path.join(workspaceDir, "poster_build");
const outDir = path.join(workspaceDir, "poster_output");
await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.slides.getItem(0);
const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs")
).href);

const C = {
  dark: "#053F36",
  green: "#087D6D",
  pale: "#EAF7F1",
  blue: "#DDF3F1",
  white: "#FFFFFF",
  text: "#15352F",
  muted: "#4E7169",
  yellow: "#F1DD20",
  line: "#B8D6CD",
};
const font = "맑은 고딕";

function setText(id, value, style = {}) {
  const sh = presentation.resolve(id);
  sh.text = value;
  sh.text.style = {
    typeface: font,
    fontSize: 64,
    color: C.text,
    wrap: "square",
    autoFit: "shrinkText",
    verticalAlignment: "middle",
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    ...style,
  };
  return sh;
}
function rect(name, x, y, w, h, fill, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry: "roundRect", name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: lineFill, width: lineWidth },
    borderRadius: 18,
  });
}
function label(name, value, x, y, w, h, opts = {}) {
  const sh = slide.shapes.add({
    geometry: "textbox", name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  sh.text = value;
  sh.text.style = {
    typeface: font,
    fontSize: opts.size ?? 48,
    bold: opts.bold ?? false,
    color: opts.color ?? C.text,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "middle",
    wrap: "square", autoFit: "shrinkText",
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return sh;
}

// Keep the supplied university header, section bands, dimensions and footer.
setText("sh/sryl4zqx", "팀명: ______", { fontSize: 60, bold: true, color: C.dark });
setText("sh/wn6dc7eh", "Speech Hero | 두두의 말소리 모험", {
  fontSize: 140, bold: true, color: C.white,
});
setText("sh/hofulsf2", "지도교수  ______        전공  ______        제작자  ______", {
  fontSize: 63, bold: true, color: C.white,
});

setText("sh/4r6dg7et", "작품 요약     문제와 해결", {
  fontSize: 60, bold: true, color: C.white,
});
setText("sh/5sfepcfe",
  "게임에서 연습한 발음이 치료사의 다음 판단과 이어지도록 설계했다.\n아이는 목표 소리를 모험 행동과 재료·제작 단어로 사용하고, 발화 맥락은 치료사 화면에 남는다.\n서버는 자료를 계산하고 AI는 선택적으로 설명한다. 목표·단서·스킬의 최종 결정은 언어재활사가 한다.",
  { fontSize: 52, color: C.text, verticalAlignment: "top" });

setText("sh/sfqdkrep", "01  치료·게임 흐름", {
  fontSize: 60, bold: true, color: C.white,
});
setText("sh/dgzetcfa",
  "치료사: 목표음·위치·단서·단어를 확정\n아동: 4개 활동(각 5라운드)에서 소리→대화 확장\n소풍 이야기: 목표 단어로 재료를 찾고 물건 제작\n재료는 다회기 누적, 짧은 회기는 중간 저장\n기본 공격은 항상 가능, 새 스킬은 치료사 승인\n연습 게임 Magic Beam과 전투 스킬은 별도",
  { fontSize: 50, color: C.text, verticalAlignment: "top" });
label("flow-status", "현재: 목표·4종 게임  |  1주 구현 목표: 승인 스킬 1개", 212, 2245, 1370, 75,
  { size: 40, bold: true, color: C.green });

setText("sh/zadcv2p8", "02  AI 기술·안전 하네스", {
  fontSize: 59, bold: true, color: C.white,
});
setText("sh/fu94fe98",
  "Web Audio: 지속·마찰·쉼 등 음향 근거 추정\nWeb Speech: 인식 문장 활용(조음 진단 아님)\nLangGraph: 검증→계산→제안→요약→검사 분리\n선택형 LLM: 계산된 근거만 설명\n안전 하네스: 입력 최소화·형식/금지표현 검사\n오류 시 템플릿 대체, 치료사 승인 전 적용 금지",
  { fontSize: 48, color: C.text, verticalAlignment: "top" });
label("ai-note", "계획 근거: REAL·치료사 확인 관찰  |  DEMO 제외", 1800, 2250, 1378, 68,
  { size: 39, bold: true, color: C.green });

setText("sh/i1gje90j", "03  게임·치료 설계", {
  fontSize: 59, bold: true, color: C.white,
});
setText("sh/j2pkne14",
  "소리·음절·단어·대화는 서로 다른 관찰 기회\n사과 찾기→간식 만들기처럼 발화와 사건 연결\n모방·독립 명명·요청·회상을 구분해 기록\n두두는 천천히 안내하고 아이 발화 중 기다림\n불확실·무발화는 실패로 계산하지 않음\n집·치료실에서 같은 목표를 이어 가는 구조",
  { fontSize: 47, color: C.text, verticalAlignment: "top" });

setText("sh/y5wjip0z", "04  실제 화면", {
  fontSize: 59, bold: true, color: C.white,
});

// Replace the template photo placeholders with screenshots of the running app.
for (const id of ["sh/utg3698n", "sh/juhg7q9s"]) {
  const sh = presentation.resolve(id);
  sh.text = "";
  sh.fill = C.white;
  sh.line = { fill: C.line, width: 2 };
}

slide.images.add({
  blob: await fs.readFile(path.join(outDir, "screenshots", "actual_dudu_monster_poster.png")),
  contentType: "image/png", alt: "원본 백호 기반 3D 두두와 몬스터가 나오는 실제 1라운드 DEMO 화면",
  fit: "contain",
  position: { left: 1840, top: 2629, width: 608, height: 592 },
});
slide.images.add({
  blob: await fs.readFile(path.join(outDir, "screenshots", "actual_dudu_therapist_square.png")),
  contentType: "image/png", alt: "실제로 실행한 치료사 검증 근거와 보수적 회기 제안 화면",
  fit: "contain",
  position: { left: 2549, top: 2629, width: 608, height: 592 },
});
label("actual-game-caption", "3D 두두 · 몬스터 1/5 DEMO", 1838, 3244, 610, 56,
  { size: 40, bold: true, color: C.dark, align: "center" });
label("actual-therapist-caption", "치료사 · 검증 근거와 제안", 2547, 3244, 610, 56,
  { size: 40, bold: true, color: C.dark, align: "center" });

setText("sh/036h8but", "05  기대효과", {
  fontSize: 59, bold: true, color: C.white,
});
setText("sh/nqxgjqtk",
  "아동 참여(기대) | 발음이 모험·재료·두두 돌보기의 의미 있는 행동이 된다.\n치료사 지원 | 정오와 단서·독립성·불확실성을 함께 보고 다음 회기를 고른다.\n현재 증거 | 4개 활동과 치료사 계획이 실행됨. 실제 발음 정확도·효과는 미검증.\n다음 검증 | 실제 마이크, 전문가 아동 음성 라벨, 치료실·가정 사용성 평가.",
  { fontSize: 51, color: C.text, verticalAlignment: "top" });
label("poster-evidence-footer",
  "검토본: 두두 3D·게임·치료사 실제 DEMO 화면  |  승인 스킬·제작·기기 간 재개는 설계",
  216, 4134, 2940, 55, { size: 42, color: C.muted });

slide.speakerNotes.textFrame.setText([
  "Speech Hero poster. Template: 2026 DU engineering festival, 90×120 cm.",
  "Current implementation evidence: C:/Users/kor02/orca/s_project/docs/v2/SPEECH_THERAPY_AI_CLINICAL_RATIONALE.md; docs/audit/PRODUCT_REALITY_MATRIX.md; backend/app/therapist_planning/graph.py.",
  "Clinical reference: ASHA Speech Sound Disorders: Articulation and Phonology, https://www.asha.org/practice-portal/clinical-topics/articulation-and-phonology/ . The product is not clinically validated.",
  "Technology reference: LangGraph overview, https://docs.langchain.com/oss/python/langgraph/overview . The repository implements a six-stage linear graph for therapist planning; the LLM is optional and limited to summary text.",
  "The embedded screenshots are actual captures of the isolated local demo app with seed data on 2026-10-03. The game shows a front-reference procedural 3D Dudu and a visual monster. The side and back model, crafting, cross-device resume, and therapist-approved combat skill are integration targets, not claims of existing implementation. Some fallback/controller/backend dialogue still says Hoya, so this is a review draft rather than the submission master.",
].join("\n"));

const draftPath = path.join(buildDir, "speech_hero_poster_draft.pptx");
await (await PresentationFile.exportPptx(presentation)).save(draftPath);
const preview = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(path.join(buildDir, "speech_hero_poster_draft.png"),
  new Uint8Array(await preview.arrayBuffer()));

const finalPath = path.join(outDir, "Speech_Hero_2026_DU_Poster_90x120_REVIEW_Dudu3D_actual_v2.pptx");
const sourceSha256 = process.env.SOURCE_SHA256;
const result = await finalizePresentation({
  workspaceDir,
  candidatePath: draftPath,
  finalPath,
  explicitTotalSlideCount: 1,
  pythonExecutable,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "32399288,43200638", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy: {
    basis: "reference", families: ["맑은 고딕", "Calibri"],
    referencePath: sourcePath, referenceSha256: sourceSha256,
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, "poster_review_dudu_actual_v2.validation.json"),
});
console.log(JSON.stringify({ finalPath, result }, null, 2));
