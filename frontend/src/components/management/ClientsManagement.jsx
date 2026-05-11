import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Building,
  Search,
  Edit,
  Trash2,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialog from "../ui/ConfirmDialog";
import BlurredText from "../ui/BlurredText";
import { toast } from "sonner";

export default function ClientsManagement() {
  const [clients, setClients] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [deletingContacts, setDeletingContacts] = useState(false);
  const [selectedClients, setSelectedClients] = useState([]);
  const [deletingClients, setDeletingClients] = useState(false);
  const [activeTab, setActiveTab] = useState("organizations");
  const [expandedClients, setExpandedClients] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsList, contactsList] = await Promise.all([
        base44.entities.Client.list("-created_date"),
        base44.entities.ContactPerson.list("-created_date")
      ]);
      setClients(clientsList);
      setContacts(contactsList);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("שגיאה בטעינת נתונים");
    }
    setLoading(false);
  };

  const getContactsForClient = (clientId) => {
    return contacts.filter(c => c.client_id === clientId);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || "לקוח לא ידוע";
  };

  const handleClientSubmit = async (formData) => {
    try {
      if (editingClient) {
        await base44.entities.Client.update(editingClient.id, formData);
      } else {
        await base44.entities.Client.create(formData);
      }
      loadData();
      setShowClientForm(false);
      setEditingClient(null);
      toast.success("הארגון נשמר בהצלחה");
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error("שגיאה בשמירת הארגון");
    }
  };

  const handleContactSubmit = async (formData) => {
    try {
      if (editingContact) {
        await base44.entities.ContactPerson.update(editingContact.id, formData);
      } else {
        await base44.entities.ContactPerson.create(formData);
      }
      loadData();
      setShowContactForm(false);
      setEditingContact(null);
      toast.success("איש הקשר נשמר בהצלחה");
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("שגיאה בשמירת איש הקשר");
    }
  };

  const handleDeleteClient = async (clientId) => {
    const clientContacts = getContactsForClient(clientId);
    setConfirmDialog({
      isOpen: true,
      message: clientContacts.length > 0 
        ? `האם אתה בטוח שברצונך למחוק את הארגון ואת ${clientContacts.length} אנשי הקשר המשויכים אליו?`
        : "האם אתה בטוח שברצונך למחוק את הארגון?",
      onConfirm: async () => {
        try {
          for (const contact of clientContacts) {
            await base44.entities.ContactPerson.delete(contact.id);
          }
          await base44.entities.Client.delete(clientId);
          loadData();
          toast.success("הארגון נמחק בהצלחה");
        } catch (error) {
          console.error("Error deleting client:", error);
          toast.error("שגיאה במחיקת הארגון");
        }
      }
    });
  };

  const handleDeleteContact = async (contactId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את איש הקשר?",
      onConfirm: async () => {
        try {
          await base44.entities.ContactPerson.delete(contactId);
          loadData();
          setSelectedContacts(prev => prev.filter(id => id !== contactId));
          toast.success("איש הקשר נמחק בהצלחה");
        } catch (error) {
          console.error("Error deleting contact:", error);
          toast.error("שגיאה במחיקת איש הקשר");
        }
      }
    });
  };

  const handleDeleteSelectedContacts = async () => {
    if (selectedContacts.length === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      message: `האם אתה בטוח שברצונך למחוק ${selectedContacts.length} אנשי קשר?`,
      onConfirm: async () => {
        setDeletingContacts(true);
        try {
          for (const contactId of selectedContacts) {
            await base44.entities.ContactPerson.delete(contactId);
          }
          loadData();
          setSelectedContacts([]);
          toast.success("אנשי הקשר נמחקו בהצלחה");
        } catch (error) {
          console.error("Error deleting contacts:", error);
          toast.error("שגיאה במחיקת אנשי הקשר");
        }
        setDeletingContacts(false);
      }
    });
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleSelectAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const toggleClientSelection = (clientId) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAllClients = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const handleDeleteSelectedClients = async () => {
    if (selectedClients.length === 0) return;
    
    let totalContacts = 0;
    for (const clientId of selectedClients) {
      totalContacts += getContactsForClient(clientId).length;
    }
    
    setConfirmDialog({
      isOpen: true,
      message: totalContacts > 0 
        ? `האם אתה בטוח שברצונך למחוק ${selectedClients.length} ארגונים ו-${totalContacts} אנשי קשר משויכים?`
        : `האם אתה בטוח שברצונך למחוק ${selectedClients.length} ארגונים?`,
      onConfirm: async () => {
        setDeletingClients(true);
        try {
          for (const clientId of selectedClients) {
            const clientContacts = getContactsForClient(clientId);
            for (const contact of clientContacts) {
              await base44.entities.ContactPerson.delete(contact.id);
            }
            await base44.entities.Client.delete(clientId);
          }
          loadData();
          setSelectedClients([]);
          toast.success("הארגונים נמחקו בהצלחה");
        } catch (error) {
          console.error("Error deleting clients:", error);
          toast.error("שגיאה במחיקת הארגונים");
        }
        setDeletingClients(false);
      }
    });
  };

  const toggleClientExpand = (clientId) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const filteredClients = clients.filter(client =>
    !searchTerm ||
    client.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredContacts = contacts.filter(contact =>
    !searchTerm ||
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getClientName(contact.client_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            ארגונים ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            אנשי קשר ({contacts.length})
          </TabsTrigger>
        </TabsList>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש ארגונים..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              {selectedClients.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteSelectedClients}
                  disabled={deletingClients}
                >
                  {deletingClients ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
                  מחק {selectedClients.length} נבחרים
                </Button>
              )}
              <Button onClick={() => setShowClientForm(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 ml-2" />
                הוספת ארגון
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                          onCheckedChange={toggleSelectAllClients}
                        />
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>שם הארגון</TableHead>
                      <TableHead className="hidden md:table-cell">אימייל</TableHead>
                      <TableHead className="hidden lg:table-cell">טלפון</TableHead>
                      <TableHead>אנשי קשר</TableHead>
                      <TableHead className="w-24">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => {
                        const clientContacts = getContactsForClient(client.id);
                        const isExpanded = expandedClients[client.id];
                        
                        return (
                          <React.Fragment key={client.id}>
                            <TableRow className={`hover:bg-gray-50 ${selectedClients.includes(client.id) ? "bg-red-50" : ""}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedClients.includes(client.id)}
                                  onCheckedChange={() => toggleClientSelection(client.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {clientContacts.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleClientExpand(client.id)}
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                                    <Building className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <BlurredText type="name">{client.name}</BlurredText>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {client.email ? (
                                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                                    <BlurredText type="email">{client.email}</BlurredText>
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {client.phone || <span className="text-gray-400">-</span>}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {clientContacts.length} אנשי קשר
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingClient(client);
                                      setShowClientForm(true);
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClient(client.id)}
                                    className="text-red-500 hover:text-red-700 h-8 w-8"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            
                            {isExpanded && clientContacts.map((contact) => (
                              <TableRow key={contact.id} className="bg-gray-50">
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="pr-10">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                      <Users className="w-3 h-3 text-green-600" />
                                    </div>
                                    <span><BlurredText type="name">{contact.name}</BlurredText></span>
                                    {contact.is_primary && (
                                      <Badge variant="outline" className="text-xs">ראשי</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {contact.email ? (
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm">
                                      <BlurredText type="email">{contact.email}</BlurredText>
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm">
                                  {contact.phone || <span className="text-gray-400">-</span>}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-500">{contact.role || "-"}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingContact(contact);
                                        setShowContactForm(true);
                                      }}
                                      className="h-7 w-7"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteContact(contact.id)}
                                      className="text-red-500 hover:text-red-700 h-7 w-7"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan="7" className="h-24 text-center">
                          לא נמצאו ארגונים
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש אנשי קשר..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              {selectedContacts.length > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteSelectedContacts}
                  disabled={deletingContacts}
                >
                  {deletingContacts ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
                  מחק {selectedContacts.length} נבחרים
                </Button>
              )}
              <Button onClick={() => setShowContactForm(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 ml-2" />
                הוספת איש קשר
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={toggleSelectAllContacts}
                        />
                      </TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead>ארגון</TableHead>
                      <TableHead className="hidden md:table-cell">אימייל</TableHead>
                      <TableHead className="hidden lg:table-cell">טלפון</TableHead>
                      <TableHead className="hidden xl:table-cell">תפקיד</TableHead>
                      <TableHead className="hidden md:table-cell">מקור</TableHead>
                      <TableHead className="w-24">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <TableRow key={contact.id} className={selectedContacts.includes(contact.id) ? "bg-red-50" : "hover:bg-gray-50"}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-green-600" />
                              </div>
                              <BlurredText type="name">{contact.name}</BlurredText>
                              {contact.is_primary && (
                                <Badge variant="outline" className="text-xs">ראשי</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-gray-400" />
                              <span className="text-sm"><BlurredText type="name">{getClientName(contact.client_id)}</BlurredText></span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {contact.email ? (
                              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm">
                                <BlurredText type="email">{contact.email}</BlurredText>
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {contact.phone || <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm">
                            {contact.role || <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className={contact.source === 'pipedrive' || contact.pipedrive_person_id ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs' : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'}>
                              {contact.source === 'pipedrive' || contact.pipedrive_person_id ? 'Pipedrive' : 'ידני'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingContact(contact);
                                  setShowContactForm(true);
                                }}
                                className="h-8 w-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteContact(contact.id)}
                                className="text-red-500 hover:text-red-700 h-8 w-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan="8" className="h-24 text-center">
                          לא נמצאו אנשי קשר
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Client Form Dialog */}
      <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? "עריכת ארגון" : "הוספת ארגון חדש"}</DialogTitle>
          </DialogHeader>
          <ClientForm
            client={editingClient}
            onSubmit={handleClientSubmit}
            onCancel={() => {
              setShowClientForm(false);
              setEditingClient(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "עריכת איש קשר" : "הוספת איש קשר חדש"}</DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={editingContact}
            clients={clients}
            onSubmit={handleContactSubmit}
            onCancel={() => {
              setShowContactForm(false);
              setEditingContact(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null })}
        onConfirm={confirmDialog.onConfirm}
        title="אישור מחיקה"
        message={confirmDialog.message}
        confirmText="מחק"
        cancelText="ביטול"
        variant="destructive"
      />
    </div>
  );
}

function ClientForm({ client, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    ...client
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("אנא הזן את שם הארגון");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="client-name">שם הארגון *</Label>
        <Input
          id="client-name"
          placeholder="הקלד את שם הארגון"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-email">אימייל</Label>
        <Input
          id="client-email"
          placeholder="example@company.com"
          type="email"
          value={formData.email || ""}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-phone">טלפון</Label>
        <Input
          id="client-phone"
          placeholder="הקלד מספר טלפון"
          value={formData.phone || ""}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {client ? "עדכן ארגון" : "צור ארגון"}
        </Button>
      </div>
    </form>
  );
}

function ContactForm({ contact, clients, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    client_id: "",
    name: "",
    email: "",
    phone: "",
    role: "",
    is_primary: false,
    ...contact
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.client_id) {
      toast.error("אנא מלא את שם איש הקשר ובחר ארגון");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="contact-client">ארגון *</Label>
        <Select
          value={formData.client_id}
          onValueChange={(value) => setFormData({...formData, client_id: value})}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר ארגון" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-name">שם איש הקשר *</Label>
        <Input
          id="contact-name"
          placeholder="הקלד את שם איש הקשר"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">אימייל</Label>
        <Input
          id="contact-email"
          placeholder="example@company.com"
          type="email"
          value={formData.email || ""}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-phone">טלפון</Label>
        <Input
          id="contact-phone"
          placeholder="הקלד מספר טלפון"
          value={formData.phone || ""}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-role">תפקיד</Label>
        <Input
          id="contact-role"
          placeholder="הקלד תפקיד"
          value={formData.role || ""}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="contact-primary"
          checked={formData.is_primary}
          onCheckedChange={(checked) => setFormData({...formData, is_primary: checked})}
        />
        <Label htmlFor="contact-primary">איש קשר ראשי</Label>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          {contact ? "עדכן איש קשר" : "צור איש קשר"}
        </Button>
      </div>
    </form>
  );
}