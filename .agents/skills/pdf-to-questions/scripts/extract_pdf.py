#!/usr/bin/env python3
"""
PDF問題抽出スクリプト

Doclingを使用してPDFから問題文と図を抽出する。

Usage:
    uv run python extract_pdf.py <pdf_path> --output <output_dir>
"""

import argparse
import json
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import ImageRefMode, PictureItem, TableItem


def extract_pdf(pdf_path: str, output_dir: str) -> None:
    """PDFから問題文と図を抽出する"""

    pdf_path = Path(pdf_path).resolve()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    figures_dir = output_dir / "figures"
    figures_dir.mkdir(exist_ok=True)

    print(f"Processing: {pdf_path}")

    # Doclingパイプライン設定
    pipeline_options = PdfPipelineOptions()
    pipeline_options.generate_page_images = True
    pipeline_options.generate_picture_images = True
    pipeline_options.images_scale = 2.0  # 高解像度
    pipeline_options.do_picture_classification = True  # 図の種類を自動分類

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    # PDF変換
    print("Converting PDF...")
    result = converter.convert(str(pdf_path))

    # Markdownテキスト保存
    text_path = output_dir / "text.md"
    result.document.save_as_markdown(
        text_path,
        image_mode=ImageRefMode.REFERENCED
    )
    print(f"Saved: {text_path}")

    # 図と表のメタデータ収集
    metadata = {
        "source": str(pdf_path),
        "figures": [],
        "tables": []
    }

    figure_counter = 0
    table_counter = 0

    for element, level in result.document.iterate_items():
        if isinstance(element, PictureItem):
            figure_counter += 1
            filename = f"figure_{figure_counter:03d}.png"
            filepath = figures_dir / filename

            try:
                image = element.get_image(result.document)
                if image:
                    image.save(filepath, "PNG")

                    # メタデータ収集
                    fig_info = {
                        "id": figure_counter,
                        "filename": filename,
                        "path": str(filepath),
                    }

                    # 分類情報があれば追加
                    if hasattr(element, 'classification') and element.classification:
                        fig_info["classification"] = element.classification

                    # バウンディングボックス情報
                    if hasattr(element, 'prov') and element.prov:
                        for prov in element.prov:
                            if hasattr(prov, 'bbox'):
                                fig_info["bbox"] = {
                                    "page": prov.page_no if hasattr(prov, 'page_no') else None,
                                }
                                break

                    metadata["figures"].append(fig_info)
                    print(f"Saved figure: {filename}")
            except Exception as e:
                print(f"Warning: Could not save figure {figure_counter}: {e}")

        elif isinstance(element, TableItem):
            table_counter += 1
            filename = f"table_{table_counter:03d}.png"
            filepath = figures_dir / filename

            try:
                image = element.get_image(result.document)
                if image:
                    image.save(filepath, "PNG")

                    table_info = {
                        "id": table_counter,
                        "filename": filename,
                        "path": str(filepath),
                    }

                    # テーブルデータがあれば追加
                    if hasattr(element, 'data') and element.data:
                        table_info["has_data"] = True

                    metadata["tables"].append(table_info)
                    print(f"Saved table: {filename}")
            except Exception as e:
                print(f"Warning: Could not save table {table_counter}: {e}")

    # メタデータ保存
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"Saved: {metadata_path}")

    # サマリー出力
    print("\n=== Extraction Summary ===")
    print(f"Text: {text_path}")
    print(f"Figures: {figure_counter}")
    print(f"Tables: {table_counter}")
    print(f"Metadata: {metadata_path}")


def main():
    parser = argparse.ArgumentParser(
        description="PDFから問題文と図を抽出する"
    )
    parser.add_argument(
        "pdf_path",
        help="入力PDFファイルのパス"
    )
    parser.add_argument(
        "--output", "-o",
        default="extracted",
        help="出力ディレクトリ（デフォルト: extracted）"
    )

    args = parser.parse_args()
    extract_pdf(args.pdf_path, args.output)


if __name__ == "__main__":
    main()
