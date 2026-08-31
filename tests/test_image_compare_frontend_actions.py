from pathlib import Path

JS = Path(__file__).resolve().parents[1] / "js" / "ruyi_image_compare.js"


def source():
    return JS.read_text(encoding="utf-8")


def test_default_comfy_preview_is_suppressed_before_core_node_output_store_consumes_images():
    text = source()
    assert "function suppressNativePreviewForRuYiExecutedEvent" in text
    assert 'api.addEventListener("executed", suppressNativePreviewForRuYiExecutedEvent)' in text
    assert "Array.isArray(output?.compare_items)" in text
    assert "detail.output = withoutNativeImagePreview(output)" in text
    assert text.index('api.addEventListener("executed", suppressNativePreviewForRuYiExecutedEvent)') < text.index("app.registerExtension({")


def test_standard_images_remain_emitted_by_backend_for_assets():
    py = (Path(__file__).resolve().parents[1] / "ruyi_image_compare.py").read_text(encoding="utf-8")
    assert '"images": [item["preview"] for item in compare_items]' in py


def test_thumbnail_context_menu_targets_full_preview_not_thumbnail():
    text = source()
    assert 'saveAs: "另存为"' in text
    assert 'copyImage: "复制图片"' in text
    assert 'thumb.addEventListener("contextmenu"' in text
    assert "showOriginalImageContextMenu" in text
    assert "viewUrl(item.preview)" in text
    assert "showSaveFilePicker" in text
    assert "ClipboardItem" in text
