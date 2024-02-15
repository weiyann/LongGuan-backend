// 引入express
import express from "express";
import cors from "cors";
import upload from "./utils/upload-imgs.js"; // 上傳圖片
import db from "./utils/connect-mysql.js"; // 資料庫
import testRouter from "./routes/index.js"; // 引入自訂router

//建立web server物件
const app = express();

// top-level middlewares // 依檔頭Content-Type來決定是否解析
app.use(cors()); // 放所有路由的前面
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 定義路由
app.get("/", (req, res) => {
  res.send("<h2>abc</h2>");
});

//  獲得客人資料的函式
const getGuestList = async (req) => {
  const perPage = 15; // 每頁20筆
  let page = +req.query.page || 1; // 用戶決定要看第幾頁

  let keyword =
    req.query.keyword && typeof req.query.keyword === "string"
      ? req.query.keyword.trim()
      : "";
  let keyword_ = db.escape(`%${keyword}%`); // 跳脫
  let qs = {};

  let where = `WHERE 1 `; // 1後面要有空白
  if (keyword) {
    // 如果有提供關鍵字，將其加入 qs 物件中，以便後續在模板中使用
    qs.keyword = keyword;
    where += `AND(\`guest_name\`LIKE${keyword_} OR \`company_name\`LIKE${keyword_} OR \`national_id\`LIKE${keyword_} OR \`phone\`LIKE${keyword_}) `;
  }

  let totalRows = 0;
  let totalPages = 0;
  let rows = [];

  // 輸出
  let output = {
    success: false,
    page,
    perPage,
    rows,
    totalRows,
    totalPages,
    qs,
    // redirect: "",
    // info: "",
  };
  // 如果頁碼小於1,導向第一頁
  if (page < 1) {
    output.redirect = `?page=1`;
    output.info = `頁碼值小於1`;
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM guest ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);

  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info = `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }
    const sql = `SELECT * FROM guest ${where} ORDER BY guest_id desc LIMIT ${
      (page - 1) * perPage
    },${perPage}`;
    [rows] = await db.query(sql);
    output = { ...output, success: true, rows, totalRows, totalPages };
  }
  return output;
};

// 獲得客人資料
app.get("/guest-list", async (req, res) => {
  const output = await getGuestList(req);
  res.json(output);
});

// 新增客人資料
app.post("/guest-add", async (req, res) => {
  const output = {
    success: false,
    postData: req.body, // 除錯用
  };
  const {
    guest_name,
    national_id,
    passport_id,
    phone,
    company_name,
    compiled,
  } = req.body.guestAdd;
  const sql =
    "INSERT INTO `guest`( `guest_name`, `national_id`, `passport_id`, `phone`, `company_name`, `compiled`, `created_at`) VALUES (?,?,?,?,?,?,NOW()) ";
  try {
    const [result] = await db.query(sql, [
      guest_name,
      national_id,
      passport_id,
      phone,
      company_name,
      compiled,
    ]);
    // 定義一個 output 的屬性 result 把 SQL查詢的值給他
    output.result = result;
    // 如果 affectedRows 是1就是true,0就是false
    output.success = !!result.affectedRows;
  } catch (ex) {
    output.exception = ex;
  }
  res.json(output);
});

// 修改客人資料
app.get("/guest-edit/:gid", async (req, res) => {
  const gid = +req.params.gid;

  const sql = `SELECT * FROM guest where guest_id = ?`;
  const [rows] = await db.query(sql, [gid]);
  if (!rows.length) {
    return res.json({ success: false });
  }
  const row = rows[0];
  res.json({ success: true, row });
});

// 修改客人資料的api
app.put("/api/guest-edit/:gid", async (req, res) => {
  const gid = +req.params.gid;
  const output = {
    success: false,
    postData: req.body,
    result: null,
  };
  const {
    guest_name,
    national_id,
    passport_id,
    phone,
    company_name,
    compiled,
  } = req.body;

  const sql =
    "UPDATE `guest` SET `guest_name`=?,`national_id`=?,`passport_id`=?,`phone`=?,`company_name`=?,`compiled`=? WHERE guest_id = ?";
  const [result] = await db.query(sql, [
    guest_name,
    national_id,
    passport_id,
    phone,
    company_name,
    compiled,
    gid,
  ]);
  output.result = result;
  output.success = !!result.changedRows;
  res.json(output);
});

// 刪除客人資料
app.delete("/guest-delete/:gid", async (req, res) => {
  const gid = +req.params.gid;
  const output = {
    success: false,
    result: null,
  };
  if (!gid || gid < 1) {
    return res.json(output);
  }
  const sql = `DELETE FROM guest where guest_id = ${gid}`;
  const [result] = await db.query(sql);
  output.result = result;
  output.success = !!result.affectedRows;
  res.json(output);
});

app.use("/test", testRouter); // 當成 middleware 使用

// 上傳圖片的路由
// 加入 middleware upload.single()
// app.post("/try-upload", upload.single("avatar"), (req, res) => {
//   res.json(req.file);
// });

// app.post("/try-uploads", upload.array("photos"), (req, res) => {
//   res.json(req.files);
// });

// 設定靜態內容的資料夾 // public裡面的內容相當於在根目錄
app.use(express.static("public"));

const port = process.env.WEB_PORT || 3001; // 如果沒設定就使用3001

app.listen(port, () => {
  console.log(`express server ${port}`);
});
