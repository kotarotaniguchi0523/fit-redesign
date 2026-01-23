#!/bin/bash
BASE_URL="https://www.isc.meiji.ac.jp/~kikn/FIT/"

# 解答略解のHTMLファイル
ANSWER_HTMLS=(
"Exam2013-Ans.html"
"Exam2014-Ans.html"
"Exam2015-Ans.html"
"Exam2016-Ans.html"
"Exam2017-Ans.html"
)

# ダウンロード実行
for html in "${ANSWER_HTMLS[@]}"; do
  echo "Downloading: $html"
  curl -s -o "$html" "${BASE_URL}${html}"
done

echo "Answer HTML files downloaded!"
