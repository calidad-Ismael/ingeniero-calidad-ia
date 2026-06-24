"""
servidor.py — Ingeniero de Calidad IA
FastAPI backend for industrial quality management (FSSC 22000 v6, ISO 22000, BRC)
"""

import os
import base64
import tempfile
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ── Clients ─────────────────────────────────────────────────────────────────
import anthropic
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
ai_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """Eres un Ingeniero de Calidad IA especializado en sistemas de gestión de inocuidad y calidad alimentaria para la industria de envases y embalajes. Tu experiencia incluye:

- FSSC 22000 versión 6 (Food Safety System Certification) incluyendo los requisitos adicionales de la categoría de materiales en contacto con alimentos
- ISO 22000:2018 (Sistemas de gestión de inocuidad de los alimentos)
- BRC/IFS Packaging (British Retail Consortium para fabricantes de envases)
- ISO 9001:2015 (Sistemas de gestión de la calidad)
- HACCP (Análisis de Peligros y Puntos Críticos de Control) aplicado a manufactura de envases
- Gestión de programas prerrequisito (PPR) para la industria de envases
- Legislación alimentaria argentina (ANMAT, CAA) y normativas internacionales (FDA, EU)
- Materiales de envase: plásticos, cartón, vidrio, metal y sus interacciones con alimentos
- Análisis de riesgos de migración de sustancias desde envases a alimentos
- Auditorías internas y externas de sistemas de calidad e inocuidad
- Redacción de procedimientos, instructivos, registros y manuales de calidad
- Gestión de no conformidades, acciones correctivas y preventivas (CAPA)
- Indicadores de desempeño (KPIs) y cuadros de mando de calidad
- Trazabilidad de materias primas y productos terminados
- Gestión de proveedores y aprobación de materiales

Cuando el usuario solicite documentos (procedimientos, instructivos, registros, planes HACCP, etc.), indícale que puedes generarlos automáticamente. Responde siempre en español argentino, con terminología técnica precisa y ejemplos prácticos aplicados a la industria de envases y embalajes."""

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ingeniero de Calidad IA",
    description="Backend para gestión de calidad industrial con IA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ──────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None

class DocumentRequest(BaseModel):
    tipo: str          # "word" | "excel" | "pdf"
    titulo: str
    contenido: str
    parametros: Optional[dict] = None

class MailRequest(BaseModel):
    asunto: str
    cuerpo: str
    remitente: Optional[str] = None

class HallazgoCreate(BaseModel):
    tipo: str          # "no_conformidad" | "observacion" | "oportunidad_mejora"
    descripcion: str
    area: str
    norma_referencia: Optional[str] = None
    evidencia: Optional[str] = None
    responsable: Optional[str] = None
    fecha_limite: Optional[str] = None

class HallazgoExport(BaseModel):
    ids: List[int]
    formato: str       # "excel" | "pdf"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ai_message(messages: list, system: str = SYSTEM_PROMPT) -> str:
    """Call Anthropic API and return text response."""
    response = ai_client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def _tmp_path(suffix: str) -> str:
    """Return a unique temporary file path."""
    name = f"calidad_{uuid.uuid4().hex}{suffix}"
    return os.path.join(tempfile.gettempdir(), name)


def _cleanup(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


# ── Word generation ──────────────────────────────────────────────────────────

def _generar_word(titulo: str, contenido: str, parametros: dict) -> str:
    from docx import Document
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # Page margins
    section = doc.sections[0]
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(3)
    section.right_margin = Cm(2.5)

    # Header
    header = section.header
    header_para = header.paragraphs[0]
    header_para.text = parametros.get("empresa", "INSUTER") + " — Sistema de Gestión de Calidad"
    header_para.style.font.size = Pt(9)
    header_para.style.font.color.rgb = RGBColor(0x00, 0x33, 0x99)

    # Footer
    footer = section.footer
    footer_para = footer.paragraphs[0]
    footer_para.text = (
        f"Documento: {parametros.get('codigo', 'DOC-001')}  |  "
        f"Revisión: {parametros.get('revision', '00')}  |  "
        f"Fecha: {datetime.now().strftime('%d/%m/%Y')}"
    )
    footer_para.style.font.size = Pt(8)

    # Title
    title_para = doc.add_heading(titulo, level=0)
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title_para.runs:
        run.font.color.rgb = RGBColor(0x00, 0x33, 0x99)

    doc.add_paragraph()

    # Metadata table
    meta_table = doc.add_table(rows=3, cols=4)
    meta_table.style = "Table Grid"
    meta_data = [
        ["Código", parametros.get("codigo", "DOC-001"), "Revisión", parametros.get("revision", "00")],
        ["Área", parametros.get("area", "Calidad"), "Aprobado por", parametros.get("aprobado_por", "")],
        ["Fecha emisión", datetime.now().strftime("%d/%m/%Y"), "Próxima revisión", parametros.get("proxima_revision", "")],
    ]
    for i, row_data in enumerate(meta_data):
        row = meta_table.rows[i]
        for j, cell_text in enumerate(row_data):
            cell = row.cells[j]
            cell.text = cell_text
            if j % 2 == 0:  # label cells
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.size = Pt(9)
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                cell._tc.get_or_add_tcPr()
                from docx.oxml.ns import qn
                from lxml import etree
                shd = etree.SubElement(cell._tc.get_or_add_tcPr(), qn("w:shd"))
                shd.set(qn("w:fill"), "003399")
                shd.set(qn("w:color"), "auto")
                shd.set(qn("w:val"), "clear")
            else:
                for run in cell.paragraphs[0].runs:
                    run.font.size = Pt(9)

    doc.add_paragraph()

    # Content — split by lines, detect headings (lines ending with ":")
    for line in contenido.split("\n"):
        stripped = line.strip()
        if not stripped:
            doc.add_paragraph()
            continue

        if stripped.startswith("## "):
            p = doc.add_heading(stripped[3:], level=2)
            for run in p.runs:
                run.font.color.rgb = RGBColor(0x00, 0x33, 0x99)
        elif stripped.startswith("# "):
            p = doc.add_heading(stripped[2:], level=1)
            for run in p.runs:
                run.font.color.rgb = RGBColor(0x00, 0x33, 0x99)
        elif stripped.endswith(":") and len(stripped) < 80:
            p = doc.add_heading(stripped, level=3)
        elif stripped.startswith("- ") or stripped.startswith("* "):
            doc.add_paragraph(stripped[2:], style="List Bullet")
        elif stripped[0].isdigit() and len(stripped) > 2 and stripped[1] in ".)" :
            doc.add_paragraph(stripped, style="List Number")
        else:
            doc.add_paragraph(stripped)

    out = _tmp_path(".docx")
    doc.save(out)
    return out


# ── Excel generation ─────────────────────────────────────────────────────────

def _generar_excel(titulo: str, contenido: str, parametros: dict) -> str:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = titulo[:31]  # sheet name max 31 chars

    BLUE = "003399"
    WHITE = "FFFFFF"
    LIGHT_BLUE = "E8EEFF"

    header_font = Font(bold=True, color=WHITE, size=11)
    header_fill = PatternFill("solid", fgColor=BLUE)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    # Title row
    ws.merge_cells("A1:H1")
    title_cell = ws["A1"]
    title_cell.value = titulo
    title_cell.font = Font(bold=True, color=WHITE, size=14)
    title_cell.fill = PatternFill("solid", fgColor=BLUE)
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    # Subtitle with date
    ws.merge_cells("A2:H2")
    subtitle = ws["A2"]
    subtitle.value = f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}  |  {parametros.get('empresa', 'INSUTER')}"
    subtitle.font = Font(italic=True, size=9)
    subtitle.fill = PatternFill("solid", fgColor=LIGHT_BLUE)
    subtitle.alignment = Alignment(horizontal="center")

    # Parse content into rows
    lines = [l.strip() for l in contenido.split("\n") if l.strip()]
    headers_row = 4  # row where column headers go

    # Try to detect table structure in content (lines with | or comma-separated)
    table_lines = [l for l in lines if "|" in l or "," in l]
    plain_lines = [l for l in lines if "|" not in l and "," not in l]

    row_idx = 3

    # Plain text section
    if plain_lines:
        for pl in plain_lines:
            ws.merge_cells(f"A{row_idx}:H{row_idx}")
            cell = ws.cell(row=row_idx, column=1, value=pl)
            cell.font = Font(size=10)
            if pl.endswith(":") or pl.startswith("#"):
                cell.font = Font(bold=True, size=10, color=BLUE)
            row_idx += 1

    if row_idx > 3:
        row_idx += 1  # blank separator

    # Table section
    if table_lines:
        parsed_rows = []
        for tl in table_lines:
            if "|" in tl:
                parts = [p.strip() for p in tl.split("|") if p.strip() and p.strip() != "---"]
            else:
                parts = [p.strip() for p in tl.split(",")]
            if parts:
                parsed_rows.append(parts)

        if parsed_rows:
            max_cols = max(len(r) for r in parsed_rows)

            # Header row of table
            for col_idx, header_val in enumerate(parsed_rows[0], start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=header_val)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_align
                cell.border = thin_border
            ws.row_dimensions[row_idx].height = 20
            row_idx += 1

            # Data rows
            for r_num, data_row in enumerate(parsed_rows[1:], start=1):
                fill = PatternFill("solid", fgColor=LIGHT_BLUE) if r_num % 2 == 0 else None
                for col_idx, val in enumerate(data_row, start=1):
                    cell = ws.cell(row=row_idx, column=col_idx, value=val)
                    cell.border = thin_border
                    cell.alignment = Alignment(wrap_text=True, vertical="top")
                    if fill:
                        cell.fill = fill
                row_idx += 1

            # Totals row if numeric columns detected
            if len(parsed_rows) > 1:
                row_idx += 1
                for col_idx in range(1, max_cols + 1):
                    col_letter = get_column_letter(col_idx)
                    data_start = headers_row + 2
                    data_end = row_idx - 2
                    # Check if column looks numeric
                    numeric_vals = []
                    for pr in parsed_rows[1:]:
                        if col_idx <= len(pr):
                            try:
                                numeric_vals.append(float(pr[col_idx - 1].replace(",", ".")))
                            except ValueError:
                                pass
                    if len(numeric_vals) == len(parsed_rows) - 1 and numeric_vals:
                        sum_cell = ws.cell(row=row_idx, column=col_idx)
                        sum_cell.value = f"=SUM({col_letter}{data_start}:{col_letter}{data_end})"
                        sum_cell.font = Font(bold=True, color=WHITE)
                        sum_cell.fill = PatternFill("solid", fgColor=BLUE)
                        sum_cell.border = thin_border
                    elif col_idx == 1:
                        cell = ws.cell(row=row_idx, column=1, value="TOTAL")
                        cell.font = Font(bold=True, color=WHITE)
                        cell.fill = PatternFill("solid", fgColor=BLUE)
                        cell.border = thin_border

            # Auto column widths
            for col_idx in range(1, max_cols + 1):
                col_letter = get_column_letter(col_idx)
                max_len = 0
                for row in ws.iter_rows(min_col=col_idx, max_col=col_idx):
                    for c in row:
                        if c.value:
                            max_len = max(max_len, len(str(c.value)))
                ws.column_dimensions[col_letter].width = min(max_len + 4, 40)

    out = _tmp_path(".xlsx")
    wb.save(out)
    return out


# ── PDF generation ───────────────────────────────────────────────────────────

def _generar_pdf(titulo: str, contenido: str, parametros: dict) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

    out = _tmp_path(".pdf")

    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        rightMargin=2.5 * cm,
        leftMargin=3 * cm,
        topMargin=3 * cm,
        bottomMargin=2.5 * cm,
        title=titulo,
        author=parametros.get("empresa", "INSUTER"),
    )

    BLUE = colors.HexColor("#003399")
    LIGHT_BLUE = colors.HexColor("#E8EEFF")

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=18,
        textColor=BLUE,
        spaceAfter=12,
        alignment=TA_CENTER,
    )
    style_h1 = ParagraphStyle(
        "CustomH1",
        parent=styles["Heading1"],
        fontSize=14,
        textColor=BLUE,
        spaceBefore=12,
        spaceAfter=6,
    )
    style_h2 = ParagraphStyle(
        "CustomH2",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=BLUE,
        spaceBefore=8,
        spaceAfter=4,
    )
    style_body = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    style_bullet = ParagraphStyle(
        "CustomBullet",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        leftIndent=20,
        bulletIndent=10,
        spaceAfter=3,
    )

    story = []

    # Header table (logo placeholder + title)
    header_data = [
        [
            Paragraph(parametros.get("empresa", "INSUTER"), ParagraphStyle("hdr", fontSize=12, textColor=colors.white, fontName="Helvetica-Bold")),
            Paragraph(titulo, ParagraphStyle("hdr2", fontSize=12, textColor=colors.white, fontName="Helvetica-Bold", alignment=TA_CENTER)),
            Paragraph(f"Cód: {parametros.get('codigo', 'DOC-001')}<br/>Rev: {parametros.get('revision', '00')}", ParagraphStyle("hdr3", fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
        ]
    ]
    header_table = Table(header_data, colWidths=[4 * cm, 9 * cm, 4 * cm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5 * cm))

    # Main title
    story.append(Paragraph(titulo, style_title))
    story.append(Spacer(1, 0.3 * cm))

    # Info table
    info_data = [
        ["Área:", parametros.get("area", "Calidad"), "Fecha:", datetime.now().strftime("%d/%m/%Y")],
        ["Aprobado por:", parametros.get("aprobado_por", ""), "Próxima revisión:", parametros.get("proxima_revision", "")],
    ]
    info_table = Table(info_data, colWidths=[3 * cm, 6 * cm, 3.5 * cm, 4.5 * cm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), BLUE),
        ("BACKGROUND", (2, 0), (2, -1), BLUE),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.white),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (1, 0), (1, -1), [colors.white, LIGHT_BLUE]),
        ("ROWBACKGROUNDS", (3, 0), (3, -1), [colors.white, LIGHT_BLUE]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.5 * cm))

    # Content
    for line in contenido.split("\n"):
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 0.2 * cm))
            continue

        if stripped.startswith("## "):
            story.append(Paragraph(stripped[3:], style_h2))
        elif stripped.startswith("# "):
            story.append(Paragraph(stripped[2:], style_h1))
        elif stripped.endswith(":") and len(stripped) < 80:
            story.append(Paragraph(f"<b>{stripped}</b>", style_body))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            story.append(Paragraph(f"• {stripped[2:]}", style_bullet))
        elif stripped[0].isdigit() and len(stripped) > 2 and stripped[1] in ".)":
            story.append(Paragraph(stripped, style_bullet))
        else:
            story.append(Paragraph(stripped, style_body))

    # Footer function
    empresa = parametros.get("empresa", "INSUTER")
    codigo = parametros.get("codigo", "DOC-001")

    def add_page_footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(3 * cm, 1.5 * cm, f"{empresa} — {codigo} — Rev {parametros.get('revision', '00')}")
        canvas.drawRightString(A4[0] - 2.5 * cm, 1.5 * cm, f"Página {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_page_footer, onLaterPages=add_page_footer)
    return out


# ── Endpoints ────────────────────────────────────────────────────────────────

# 1. POST /consultas/chat
@app.post("/consultas/chat")
async def chat(request: ChatRequest):
    """Send messages to the AI and get a response."""
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        system = SYSTEM_PROMPT
        if request.context:
            system = f"{SYSTEM_PROMPT}\n\nContexto adicional:\n{request.context}"

        response_text = _ai_message(messages, system=system)
        return {"respuesta": response_text, "modelo": MODEL}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en consulta: {str(e)}")


# 2. POST /documentos/subir
@app.post("/documentos/subir")
async def subir_documento(
    archivo: UploadFile = File(...),
    nombre: str = Form(...),
    descripcion: str = Form(""),
    categoria: str = Form("general"),
):
    """Upload a document to Supabase Storage and register in DB."""
    try:
        contenido = await archivo.read()
        extension = os.path.splitext(archivo.filename)[1]
        storage_path = f"documentos/{uuid.uuid4().hex}{extension}"

        # Upload to Supabase Storage
        supabase.storage.from_("documentos").upload(
            storage_path,
            contenido,
            {"content-type": archivo.content_type or "application/octet-stream"},
        )

        # Get public URL
        url = supabase.storage.from_("documentos").get_public_url(storage_path)

        # Register in DB
        record = {
            "nombre": nombre,
            "descripcion": descripcion,
            "categoria": categoria,
            "storage_path": storage_path,
            "url": url,
            "tipo_archivo": extension.lstrip("."),
            "tamaño_bytes": len(contenido),
            "estado": "activo",
            "fecha_subida": datetime.now().isoformat(),
        }
        result = supabase.table("documentos").insert(record).execute()
        return {"mensaje": "Documento subido correctamente", "documento": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir documento: {str(e)}")


# 3. GET /documentos/listar
@app.get("/documentos/listar")
async def listar_documentos(categoria: Optional[str] = None):
    """List active documents, optionally filtered by category."""
    try:
        query = supabase.table("documentos").select("*").eq("estado", "activo")
        if categoria:
            query = query.eq("categoria", categoria)
        result = query.order("fecha_subida", desc=True).execute()
        return {"documentos": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar documentos: {str(e)}")


# 4. POST /documentos/procesar
@app.post("/documentos/procesar")
async def procesar_documento(documento_id: int, pregunta: Optional[str] = None):
    """Process a document with AI — summarize or answer a question about it."""
    try:
        result = supabase.table("documentos").select("*").eq("id", documento_id).single().execute()
        doc = result.data
        if not doc:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        prompt = (
            f"Analiza el siguiente documento de calidad y responde: {pregunta}"
            if pregunta
            else "Analiza este documento de calidad y proporciona un resumen ejecutivo, puntos clave y recomendaciones."
        )
        messages = [
            {
                "role": "user",
                "content": f"{prompt}\n\nDocumento: {doc['nombre']}\nDescripción: {doc.get('descripcion', '')}\nCategoría: {doc.get('categoria', '')}",
            }
        ]
        respuesta = _ai_message(messages)
        return {"respuesta": respuesta, "documento": doc["nombre"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar documento: {str(e)}")


# 5. POST /documentos/obsoleto/{id}
@app.post("/documentos/obsoleto/{id}")
async def marcar_obsoleto(id: int, motivo: str = ""):
    """Mark a document as obsolete."""
    try:
        result = supabase.table("documentos").update({
            "estado": "obsoleto",
            "motivo_obsolescencia": motivo,
            "fecha_obsolescencia": datetime.now().isoformat(),
        }).eq("id", id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        return {"mensaje": "Documento marcado como obsoleto", "documento": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# 6. GET /documentos/obsoletos
@app.get("/documentos/obsoletos")
async def listar_obsoletos():
    """List all obsolete documents."""
    try:
        result = supabase.table("documentos").select("*").eq("estado", "obsoleto").order(
            "fecha_obsolescencia", desc=True
        ).execute()
        return {"documentos": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# 7. POST /documentos/restaurar/{id}
@app.post("/documentos/restaurar/{id}")
async def restaurar_documento(id: int):
    """Restore an obsolete document to active status."""
    try:
        result = supabase.table("documentos").update({
            "estado": "activo",
            "motivo_obsolescencia": None,
            "fecha_obsolescencia": None,
        }).eq("id", id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        return {"mensaje": "Documento restaurado correctamente", "documento": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# 8. DELETE /documentos/obsoletos/{id}
@app.delete("/documentos/obsoletos/{id}")
async def eliminar_obsoleto(id: int):
    """Permanently delete an obsolete document from storage and DB."""
    try:
        # Get document info
        result = supabase.table("documentos").select("*").eq("id", id).eq("estado", "obsoleto").single().execute()
        doc = result.data
        if not doc:
            raise HTTPException(status_code=404, detail="Documento obsoleto no encontrado")

        # Remove from storage
        if doc.get("storage_path"):
            try:
                supabase.storage.from_("documentos").remove([doc["storage_path"]])
            except Exception:
                pass  # Continue even if storage deletion fails

        # Remove from DB
        supabase.table("documentos").delete().eq("id", id).execute()
        return {"mensaje": "Documento eliminado permanentemente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# 9. POST /generar-documento
@app.post("/generar-documento")
async def generar_documento(request: DocumentRequest):
    """Generate a Word, Excel or PDF document with AI-assisted content."""
    tmp_path = None
    try:
        # If content is empty or just a title, ask AI to generate it
        contenido = request.contenido
        if not contenido or len(contenido.strip()) < 50:
            messages = [
                {
                    "role": "user",
                    "content": (
                        f"Genera el contenido completo para el siguiente documento de gestión de calidad:\n"
                        f"Título: {request.titulo}\n"
                        f"Tipo: {request.tipo}\n"
                        f"Parámetros adicionales: {request.parametros or {}}\n\n"
                        f"Proporciona el contenido estructurado con secciones, subsecciones y texto detallado. "
                        f"Usa formato markdown con # para títulos principales y ## para subsecciones."
                    ),
                }
            ]
            contenido = _ai_message(messages)

        parametros = request.parametros or {}

        if request.tipo == "word":
            tmp_path = _generar_word(request.titulo, contenido, parametros)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            suffix = ".docx"
        elif request.tipo == "excel":
            tmp_path = _generar_excel(request.titulo, contenido, parametros)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            suffix = ".xlsx"
        elif request.tipo == "pdf":
            tmp_path = _generar_pdf(request.titulo, contenido, parametros)
            media_type = "application/pdf"
            suffix = ".pdf"
        else:
            raise HTTPException(status_code=400, detail="Tipo de documento inválido. Use 'word', 'excel' o 'pdf'.")

        filename = f"{request.titulo.replace(' ', '_')}{suffix}"
        return FileResponse(
            path=tmp_path,
            media_type=media_type,
            filename=filename,
            background=None,
        )
    except HTTPException:
        if tmp_path:
            _cleanup(tmp_path)
        raise
    except Exception as e:
        if tmp_path:
            _cleanup(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error al generar documento: {str(e)}")


# 10. POST /procesar-mail
@app.post("/procesar-mail")
async def procesar_mail(request: MailRequest):
    """
    Process an incoming email:
    - Detect if it requests a document
    - If yes: generate the document and return it as base64 + draft reply
    - If no: return AI-generated reply draft
    """
    try:
        # Step 1: Classify the email with AI
        clasificacion_msg = [
            {
                "role": "user",
                "content": (
                    f"Analiza el siguiente correo y determina:\n"
                    f"1. ¿Solicita algún documento de calidad (procedimiento, instructivo, registro, plan HACCP, etc.)? Responde SÍ o NO.\n"
                    f"2. Si sí, ¿qué tipo de documento se solicita exactamente?\n"
                    f"3. ¿Cuál es el tema principal del correo?\n\n"
                    f"Asunto: {request.asunto}\n"
                    f"Cuerpo:\n{request.cuerpo}\n\n"
                    f"Responde en formato JSON exacto:\n"
                    f'{{"solicita_documento": true/false, "tipo_documento": "...", "titulo_sugerido": "...", "tema": "..."}}'
                ),
            }
        ]
        clasificacion_raw = _ai_message(clasificacion_msg)

        # Parse JSON from response
        import json
        import re

        json_match = re.search(r"\{[^{}]+\}", clasificacion_raw, re.DOTALL)
        clasificacion = {}
        if json_match:
            try:
                clasificacion = json.loads(json_match.group())
            except json.JSONDecodeError:
                clasificacion = {"solicita_documento": False, "tema": request.asunto}

        resultado = {
            "clasificacion": clasificacion,
            "documento_generado": False,
            "documento_base64": None,
            "nombre_archivo": None,
            "borrador_respuesta": None,
        }

        # Step 2: Generate document if requested
        if clasificacion.get("solicita_documento"):
            titulo = clasificacion.get("titulo_sugerido", clasificacion.get("tipo_documento", "Documento de Calidad"))

            # Generate content with AI
            gen_msg = [
                {
                    "role": "user",
                    "content": (
                        f"Genera el contenido completo para el siguiente documento solicitado por email:\n"
                        f"Título: {titulo}\n"
                        f"Contexto del correo: {request.cuerpo[:500]}\n\n"
                        f"Proporciona el contenido estructurado con secciones usando # y ## para encabezados."
                    ),
                }
            ]
            contenido = _ai_message(gen_msg)

            # Generate Word document
            tmp_path = _generar_word(titulo, contenido, {"empresa": "INSUTER", "codigo": "DOC-AUTO", "revision": "00"})

            # Read and encode as base64
            with open(tmp_path, "rb") as f:
                doc_bytes = f.read()
            _cleanup(tmp_path)

            resultado["documento_generado"] = True
            resultado["documento_base64"] = base64.b64encode(doc_bytes).decode("utf-8")
            resultado["nombre_archivo"] = f"{titulo.replace(' ', '_')}.docx"

            # Draft reply acknowledging document
            reply_msg = [
                {
                    "role": "user",
                    "content": (
                        f"Redacta una respuesta profesional al siguiente correo, indicando que se adjunta el documento solicitado ({titulo}).\n"
                        f"El remitente es: {request.remitente or 'el solicitante'}\n"
                        f"Correo original:\nAsunto: {request.asunto}\n{request.cuerpo[:300]}\n\n"
                        f"La respuesta debe ser breve, profesional y en español."
                    ),
                }
            ]
        else:
            # Draft reply for non-document emails
            reply_msg = [
                {
                    "role": "user",
                    "content": (
                        f"Redacta una respuesta profesional al siguiente correo relacionado con gestión de calidad.\n"
                        f"El remitente es: {request.remitente or 'el solicitante'}\n"
                        f"Correo:\nAsunto: {request.asunto}\n{request.cuerpo}\n\n"
                        f"La respuesta debe ser profesional, técnica y en español argentino."
                    ),
                }
            ]

        borrador = _ai_message(reply_msg)
        resultado["borrador_respuesta"] = borrador

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar correo: {str(e)}")


# 11. GET /hallazgos/listar
@app.get("/hallazgos/listar")
async def listar_hallazgos(
    tipo: Optional[str] = None,
    area: Optional[str] = None,
    estado: Optional[str] = None,
):
    """List audit findings with optional filters."""
    try:
        query = supabase.table("hallazgos").select("*")
        if tipo:
            query = query.eq("tipo", tipo)
        if area:
            query = query.eq("area", area)
        if estado:
            query = query.eq("estado", estado)
        result = query.order("fecha_creacion", desc=True).execute()
        return {"hallazgos": result.data, "total": len(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar hallazgos: {str(e)}")


# 12. POST /hallazgos/crear
@app.post("/hallazgos/crear")
async def crear_hallazgo(hallazgo: HallazgoCreate):
    """Create a new audit finding."""
    try:
        record = {
            "tipo": hallazgo.tipo,
            "descripcion": hallazgo.descripcion,
            "area": hallazgo.area,
            "norma_referencia": hallazgo.norma_referencia,
            "evidencia": hallazgo.evidencia,
            "responsable": hallazgo.responsable,
            "fecha_limite": hallazgo.fecha_limite,
            "estado": "abierto",
            "fecha_creacion": datetime.now().isoformat(),
        }
        result = supabase.table("hallazgos").insert(record).execute()
        return {"mensaje": "Hallazgo creado correctamente", "hallazgo": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear hallazgo: {str(e)}")


# 13. GET /hallazgos/{id}/accion-correctiva
@app.get("/hallazgos/{id}/accion-correctiva")
async def generar_accion_correctiva(id: int):
    """Use AI to generate a corrective action plan for a finding."""
    try:
        result = supabase.table("hallazgos").select("*").eq("id", id).single().execute()
        hallazgo = result.data
        if not hallazgo:
            raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

        messages = [
            {
                "role": "user",
                "content": (
                    f"Genera un plan de acción correctiva completo para el siguiente hallazgo de auditoría:\n\n"
                    f"Tipo: {hallazgo['tipo']}\n"
                    f"Descripción: {hallazgo['descripcion']}\n"
                    f"Área afectada: {hallazgo['area']}\n"
                    f"Norma de referencia: {hallazgo.get('norma_referencia', 'No especificada')}\n"
                    f"Evidencia: {hallazgo.get('evidencia', 'No especificada')}\n\n"
                    f"El plan debe incluir:\n"
                    f"1. Análisis de causa raíz (metodología 5 Por qué o Ishikawa)\n"
                    f"2. Corrección inmediata\n"
                    f"3. Acciones correctivas a corto, mediano y largo plazo\n"
                    f"4. Indicadores de eficacia\n"
                    f"5. Responsables y plazos sugeridos\n"
                    f"6. Documentos a actualizar si aplica\n"
                    f"7. Criterios de cierre del hallazgo\n\n"
                    f"Considera los requisitos de la norma {hallazgo.get('norma_referencia', 'FSSC 22000 v6')} en tu respuesta."
                ),
            }
        ]
        plan = _ai_message(messages)

        # Save the generated plan to DB
        supabase.table("hallazgos").update({
            "accion_correctiva": plan,
            "fecha_accion_correctiva": datetime.now().isoformat(),
            "estado": "en_proceso",
        }).eq("id", id).execute()

        return {
            "hallazgo_id": id,
            "hallazgo": hallazgo,
            "accion_correctiva": plan,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar acción correctiva: {str(e)}")


# 14. POST /hallazgos/exportar
@app.post("/hallazgos/exportar")
async def exportar_hallazgos(request: HallazgoExport):
    """Export selected findings to Excel or PDF."""
    tmp_path = None
    try:
        # Fetch findings
        result = supabase.table("hallazgos").select("*").in_("id", request.ids).execute()
        hallazgos = result.data
        if not hallazgos:
            raise HTTPException(status_code=404, detail="No se encontraron hallazgos")

        if request.formato == "excel":
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter

            wb = Workbook()
            ws = wb.active
            ws.title = "Hallazgos"

            BLUE = "003399"
            WHITE = "FFFFFF"
            LIGHT_BLUE = "E8EEFF"

            header_font = Font(bold=True, color=WHITE, size=10)
            header_fill = PatternFill("solid", fgColor=BLUE)
            thin = Border(
                left=Side(style="thin"), right=Side(style="thin"),
                top=Side(style="thin"), bottom=Side(style="thin"),
            )

            # Title
            ws.merge_cells("A1:H1")
            t = ws["A1"]
            t.value = f"Reporte de Hallazgos — {datetime.now().strftime('%d/%m/%Y')}"
            t.font = Font(bold=True, color=WHITE, size=14)
            t.fill = PatternFill("solid", fgColor=BLUE)
            t.alignment = Alignment(horizontal="center", vertical="center")
            ws.row_dimensions[1].height = 28

            # Headers
            columns = ["ID", "Tipo", "Área", "Descripción", "Norma", "Estado", "Responsable", "Fecha Límite"]
            for col_idx, col_name in enumerate(columns, start=1):
                cell = ws.cell(row=2, column=col_idx, value=col_name)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                cell.border = thin
            ws.row_dimensions[2].height = 20

            # Data rows
            for r_num, h in enumerate(hallazgos, start=3):
                fill = PatternFill("solid", fgColor=LIGHT_BLUE) if r_num % 2 == 0 else None
                row_data = [
                    h.get("id"),
                    h.get("tipo", ""),
                    h.get("area", ""),
                    h.get("descripcion", ""),
                    h.get("norma_referencia", ""),
                    h.get("estado", ""),
                    h.get("responsable", ""),
                    h.get("fecha_limite", ""),
                ]
                for col_idx, val in enumerate(row_data, start=1):
                    cell = ws.cell(row=r_num, column=col_idx, value=val)
                    cell.border = thin
                    cell.alignment = Alignment(wrap_text=True, vertical="top")
                    if fill:
                        cell.fill = fill

            # Auto column widths
            col_widths = [6, 18, 18, 50, 20, 15, 20, 15]
            for col_idx, width in enumerate(col_widths, start=1):
                ws.column_dimensions[get_column_letter(col_idx)].width = width

            # Summary stats
            ws.append([])
            summary_row = ws.max_row + 1
            tipos = {}
            estados = {}
            for h in hallazgos:
                tipos[h.get("tipo", "otro")] = tipos.get(h.get("tipo", "otro"), 0) + 1
                estados[h.get("estado", "abierto")] = estados.get(h.get("estado", "abierto"), 0) + 1

            ws.cell(row=summary_row, column=1, value="RESUMEN").font = Font(bold=True, color=WHITE)
            ws.cell(row=summary_row, column=1).fill = PatternFill("solid", fgColor=BLUE)

            for i, (tipo, count) in enumerate(tipos.items()):
                ws.cell(row=summary_row + i + 1, column=1, value=tipo)
                ws.cell(row=summary_row + i + 1, column=2, value=count)

            tmp_path = _tmp_path(".xlsx")
            wb.save(tmp_path)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"hallazgos_{datetime.now().strftime('%Y%m%d')}.xlsx"

        elif request.formato == "pdf":
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.units import cm
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

            tmp_path = _tmp_path(".pdf")
            doc = SimpleDocTemplate(tmp_path, pagesize=landscape(A4), rightMargin=2 * cm, leftMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)

            BLUE_C = colors.HexColor("#003399")
            LIGHT = colors.HexColor("#E8EEFF")
            styles = getSampleStyleSheet()

            story = []
            story.append(Paragraph(f"<b>Reporte de Hallazgos</b> — {datetime.now().strftime('%d/%m/%Y')}", ParagraphStyle("t", fontSize=16, textColor=BLUE_C, spaceAfter=12)))

            # Table data
            table_data = [["ID", "Tipo", "Área", "Descripción", "Norma", "Estado", "Responsable"]]
            for h in hallazgos:
                desc = (h.get("descripcion") or "")[:100] + ("..." if len(h.get("descripcion") or "") > 100 else "")
                table_data.append([
                    str(h.get("id", "")),
                    h.get("tipo", ""),
                    h.get("area", ""),
                    desc,
                    h.get("norma_referencia", ""),
                    h.get("estado", ""),
                    h.get("responsable", ""),
                ])

            col_widths = [1.5 * cm, 3 * cm, 3 * cm, 8 * cm, 3.5 * cm, 2.5 * cm, 3.5 * cm]
            t = Table(table_data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BLUE_C),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.5 * cm))
            story.append(Paragraph(f"Total de hallazgos exportados: {len(hallazgos)}", styles["Normal"]))

            doc.build(story)
            media_type = "application/pdf"
            filename = f"hallazgos_{datetime.now().strftime('%Y%m%d')}.pdf"
        else:
            raise HTTPException(status_code=400, detail="Formato inválido. Use 'excel' o 'pdf'.")

        return FileResponse(path=tmp_path, media_type=media_type, filename=filename)

    except HTTPException:
        if tmp_path:
            _cleanup(tmp_path)
        raise
    except Exception as e:
        if tmp_path:
            _cleanup(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error al exportar hallazgos: {str(e)}")


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "aplicacion": "Ingeniero de Calidad IA",
        "version": "1.0.0",
        "estado": "operativo",
        "modelo_ia": MODEL,
        "endpoints": [
            "POST /consultas/chat",
            "POST /documentos/subir",
            "GET /documentos/listar",
            "POST /documentos/procesar",
            "POST /documentos/obsoleto/{id}",
            "GET /documentos/obsoletos",
            "POST /documentos/restaurar/{id}",
            "DELETE /documentos/obsoletos/{id}",
            "POST /generar-documento",
            "POST /procesar-mail",
            "GET /hallazgos/listar",
            "POST /hallazgos/crear",
            "GET /hallazgos/{id}/accion-correctiva",
            "POST /hallazgos/exportar",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("servidor:app", host="0.0.0.0", port=8000, reload=True)
