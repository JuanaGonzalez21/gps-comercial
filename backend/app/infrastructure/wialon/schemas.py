"""Validation models for raw Wialon payloads (SEG-08: never trust external data blindly).

They are lenient with unknown keys (Wialon adds fields over time) but strict with types. An item
that fails validation is skipped and logged by the mapper instead of breaking the whole response.
"""

from pydantic import BaseModel, ConfigDict, Field


class _Raw(BaseModel):
    model_config = ConfigDict(extra="ignore")


class RawPosition(_Raw):
    t: int = 0
    y: float | None = None  # latitude
    x: float | None = None  # longitude
    z: float | None = None
    s: float | None = None  # speed, km/h
    c: float | None = None  # course, degrees
    sc: int | None = None


class RawLastMessage(_Raw):
    t: int = 0


class RawCustomField(_Raw):
    id: int
    n: str
    v: str = ""


class RawUnit(_Raw):
    id: int
    nm: str
    pos: RawPosition | None = None
    lmsg: RawLastMessage | None = None
    flds: dict[str, RawCustomField] | list[RawCustomField] | None = None


class RawDriver(_Raw):
    id: int
    n: str = ""
    c: str = ""
    ds: str = ""
    p: str = ""
    bu: int = 0


class RawTag(_Raw):
    id: int
    n: str = ""
    c: str = ""
    p: str = ""
    bu: int = 0
    jp: dict[str, str] | list[object] | None = None


class RawResource(_Raw):
    id: int
    nm: str
    drvrs: dict[str, dict[str, object]] | list[object] | None = None
    tags: dict[str, dict[str, object]] | list[object] | None = None


class RawSearchResult(_Raw):
    total_items_count: int = Field(default=0, alias="totalItemsCount")
    items: list[dict[str, object]] = Field(default_factory=list)


class RawMessage(_Raw):
    t: int = 0
    pos: RawPosition | None = None


class RawMessages(_Raw):
    count: int = 0
    messages: list[dict[str, object]] = Field(default_factory=list)
