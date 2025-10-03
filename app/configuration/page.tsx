'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface GameItem {
  name: string;
  youtubeLink: string;
  proposedBy: string[];
}

interface GameConfig {
  id: string;
  name: string;
  description: string;
  items: GameItem[];
  createdAt: string;
  createdBy: string;
}

interface User {
  id: number;
  name: string;
}

export default function ConfigurationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [gameName, setGameName] = useState('');
  const [gameDescription, setGameDescription] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemYoutubeLink, setItemYoutubeLink] = useState('');
  const [itemProposedBy, setItemProposedBy] = useState<string[]>([]);
  const [items, setItems] = useState<GameItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [dbConfigs, setDbConfigs] = useState<any[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
    } else {
      fetchUsers();
      fetchDbConfigs();
      fetchUserRole();
    }
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/list');
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }
  };

  const fetchDbConfigs = async () => {
    try {
      const response = await fetch('/api/configurations/list');
      if (response.ok) {
        setDbConfigs(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des configurations:', error);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const data = await response.json();
        setUserRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle utilisateur:', error);
    }
  };

  const saveConfig = async () => {
    if (!gameName.trim() || items.length < 2) {
      alert('Veuillez renseigner un nom et au moins 2 items');
      return;
    }

    const newConfig: GameConfig = {
      id: editingConfigId || Date.now().toString(),
      name: gameName.trim(),
      description: gameDescription.trim(),
      items: items,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.name || 'Anonyme',
    };

    // Sauvegarde en base de données uniquement
    try {
      const response = await fetch('/api/configurations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configData: newConfig,
          isEdit: !!editingConfigId,
          configId: editingConfigId
        }),
      });

      if (response.ok) {
        fetchDbConfigs();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde en base de données:', error);
    }

    resetForm();
  };

  const resetForm = () => {
    setGameName('');
    setGameDescription('');
    setItems([]);
    setItemName('');
    setItemYoutubeLink('');
    setItemProposedBy([]);
    setShowCreateForm(false);
    setShowAddItemModal(false);
    setEditingConfigId(null);
  };

  const addItem = () => {
    if (!itemName.trim() || itemProposedBy.length === 0) {
      alert('Veuillez renseigner le nom et au moins une personne');
      return;
    }

    const newItem: GameItem = {
      name: itemName.trim(),
      youtubeLink: itemYoutubeLink.trim(),
      proposedBy: itemProposedBy,
    };

    if (editingItemIndex !== null) {
      // Modification d'un item existant
      const updatedItems = [...items];
      updatedItems[editingItemIndex] = newItem;
      setItems(updatedItems);
      setEditingItemIndex(null);
    } else {
      // Ajout d'un nouvel item
      setItems([...items, newItem]);
    }

    setItemName('');
    setItemYoutubeLink('');
    setItemProposedBy([]);
    setShowAddItemModal(false);
  };

  const editItem = (index: number) => {
    const item = items[index];
    setItemName(item.name);
    setItemYoutubeLink(item.youtubeLink);
    setItemProposedBy(item.proposedBy);
    setEditingItemIndex(index);
    setShowAddItemModal(true);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const toggleProposedBy = (userName: string) => {
    if (itemProposedBy.includes(userName)) {
      setItemProposedBy(itemProposedBy.filter((name) => name !== userName));
    } else {
      setItemProposedBy([...itemProposedBy, userName]);
    }
  };

  const importConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedConfig: GameConfig = JSON.parse(text);

      // Sauvegarder en base de données
      const response = await fetch('/api/configurations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configData: importedConfig }),
      });

      if (response.ok) {
        fetchDbConfigs();
        alert('Configuration importée avec succès !');
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de l\'import du fichier');
    }

    // Reset input
    event.target.value = '';
  };

  const editConfig = async (configId: string, filePath: string) => {
    try {
      const response = await fetch(filePath);
      const configData: GameConfig = await response.json();

      setEditingConfigId(configId);
      setGameName(configData.name);
      setGameDescription(configData.description || '');
      setItems(configData.items);
      setShowCreateForm(true);
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
      alert('Erreur lors du chargement de la configuration');
    }
  };


  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            ← Retour
          </button>
          {!showCreateForm && (userRoles.includes('config_creator') || userRoles.includes('admin')) && (
            <div className="flex gap-3">
              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={importConfig}
                  className="hidden"
                />
                Importer configuration
              </label>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                + Nouvelle configuration
              </button>
            </div>
          )}
        </div>

        <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-6 shadow-xl">
          <h1 className="text-2xl font-semibold text-zinc-200 mb-6 flex items-center gap-3">
            <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
            Configuration de jeux
          </h1>

          {showCreateForm ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Nom du jeu
                </label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Ex: Meilleurs films 2024"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={gameDescription}
                  onChange={(e) => setGameDescription(e.target.value)}
                  placeholder="Décrivez votre jeu..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none"
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Items à comparer ({items.length})
                </label>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer mb-3"
                >
                  + Ajouter un item
                </button>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-zinc-200 font-medium text-sm mb-1">{item.name}</h4>
                          {item.youtubeLink && (
                            <a
                              href={item.youtubeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:text-purple-300 text-xs break-all"
                            >
                              {item.youtubeLink}
                            </a>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.proposedBy.map((person, i) => (
                              <span
                                key={i}
                                className="text-xs bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded"
                              >
                                {person}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => editItem(index)}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveConfig}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {dbConfigs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-zinc-400 mb-4">Aucune configuration créée</p>
                  <p className="text-zinc-500 text-sm">
                    Créez votre première configuration de jeu pour commencer
                  </p>
                </div>
              ) : (
                dbConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-zinc-200 text-lg mb-1">
                          {config.file_name}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>Par {config.created_by}</span>
                          <span>
                            {new Date(config.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={config.file_path}
                          download
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                        >
                          Télécharger
                        </a>
                        {config.created_by === session?.user?.name && (
                          <>
                            <button
                              onClick={() => editConfig(config.id, config.file_path)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ?')) return;
                                try {
                                  const response = await fetch('/api/configurations/delete', {
                                    method: 'DELETE',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ configId: config.id }),
                                  });
                                  if (response.ok) {
                                    fetchDbConfigs();
                                  }
                                } catch (error) {
                                  console.error('Erreur lors de la suppression:', error);
                                }
                              }}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal d'ajout d'item */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-zinc-200 mb-4">
                {editingItemIndex !== null ? 'Modifier l\'item' : 'Ajouter un item'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Nom de l'item *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ex: Inception"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Lien YouTube (optionnel)
                  </label>
                  <input
                    type="url"
                    value={itemYoutubeLink}
                    onChange={(e) => setItemYoutubeLink(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Proposé par * ({itemProposedBy.length} sélectionné{itemProposedBy.length > 1 ? 's' : ''})
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-zinc-700/50 p-2 rounded transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={itemProposedBy.includes(user.name)}
                          onChange={() => toggleProposedBy(user.name)}
                          className="cursor-pointer"
                        />
                        <span className="text-zinc-200 text-sm">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={addItem}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Ajouter
                </button>
                <button
                  onClick={() => {
                    setShowAddItemModal(false);
                    setItemName('');
                    setItemYoutubeLink('');
                    setItemProposedBy([]);
                  }}
                  className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}