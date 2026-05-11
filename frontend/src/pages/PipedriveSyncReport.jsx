import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Search, ExternalLink, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PipedriveSyncReport() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const all = await base44.asServiceRole.entities.Candidate.list("-created_date", 5000);
      setCandidates(all);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = candidates.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.pipedrive_person_id || "").includes(q)
    );
  });

  const synced = filtered.filter(c => c.pipedrive_synced && c.pipedrive_person_id);
  const notSynced = filtered.filter(c => !c.pipedrive_synced || !c.pipedrive_person_id);

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">דוח סנכרון Pipedrive</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-gray-700">{candidates.length}</div>
            <div className="text-sm text-gray-500 mt-1">סה"כ מועמדים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              {candidates.filter(c => c.pipedrive_synced && c.pipedrive_person_id).length}
            </div>
            <div className="text-sm text-gray-500 mt-1">מסונכרנים</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-red-500">
              {candidates.filter(c => !c.pipedrive_synced || !c.pipedrive_person_id).length}
            </div>
            <div className="text-sm text-gray-500 mt-1">לא מסונכרנים</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="חיפוש לפי שם, מייל או Pipedrive ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} מועמדים
            {search && <span className="text-gray-400 font-normal"> (מסונן)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם מועמד</TableHead>
                    <TableHead className="text-right">אימייל</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">Pipedrive ID</TableHead>
                    <TableHead className="text-right">תאריך סנכרון</TableHead>
                    <TableHead className="text-right">היסטוריה</TableHead>
                    <TableHead className="text-right">סיכום הערות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link
                          to={`${createPageUrl("Candidates")}?id=${c.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim()}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{c.email || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600">{c.phone_primary || "—"}</TableCell>
                      <TableCell>
                        {c.pipedrive_synced && c.pipedrive_person_id ? (
                          <Badge className="bg-green-100 text-green-700 gap-1">
                            <CheckCircle className="w-3 h-3" />
                            מסונכרן
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 gap-1">
                            <XCircle className="w-3 h-3" />
                            לא מסונכרן
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.pipedrive_person_id ? (
                          <a
                            href={`https://pandatech.pipedrive.com/person/${c.pipedrive_person_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                          >
                            {c.pipedrive_person_id}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {c.pipedrive_sync_date
                          ? new Date(c.pipedrive_sync_date).toLocaleDateString("he-IL")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {c.pipedrive_history ? (
                          <div className="text-xs text-gray-600 max-h-16 overflow-y-auto whitespace-pre-wrap">
                            {c.pipedrive_history.substring(0, 200)}
                            {c.pipedrive_history.length > 200 ? "..." : ""}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {c.pipedrive_notes_summary ? (
                          <div className="text-xs text-gray-600 max-h-16 overflow-y-auto whitespace-pre-wrap">
                            {c.pipedrive_notes_summary.substring(0, 200)}
                            {c.pipedrive_notes_summary.length > 200 ? "..." : ""}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}