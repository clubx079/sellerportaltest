"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getCurrentCurrencySymbol } from '@/lib/currency';
import {
  LayoutDashboard,
  Calendar,
  DoorOpen,
  Users,
  DollarSign,
  Building2,
  CalendarCheck,
  BedDouble,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Eye,
  Plus,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  PieChart,
  BarChart3,
  Utensils,
  Receipt
} from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalProperties: 0,
    draftProperties: 0,
    publishedProperties: 0,
    archivedProperties: 0,
    availableProperties: 0,
    soldProperties: 0,
    underContractProperties: 0,
    totalValue: 0,
    averagePrice: 0,
    totalBedrooms: 0,
    totalBathrooms: 0,
    recentlyAdded: 0
  });
  const [recentProperties, setRecentProperties] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [currency, setCurrency] = useState('$');

  useEffect(() => {
    const userStr = localStorage.getItem('seller_user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }

    setCurrency(getCurrentCurrencySymbol());

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get user_id from localStorage
      const userStr = localStorage.getItem('seller_user');
      if (!userStr) {
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(userStr);
      const currentUserId = currentUser.id;

      // First, get the seller's temp_seller_id
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_applications')
        .select('temp_seller_id')
        .eq('id', currentUserId)
        .single();

      if (sellerError || !sellerData?.temp_seller_id) {
        console.error('Error fetching seller data:', sellerError);
        setLoading(false);
        return;
      }

      // Fetch wholesale deals with photos
      const { data: properties, error } = await supabase
        .from('wholesale_deals')
        .select(`
          *,
          property_photos (
            id,
            photo_url,
            display_order,
            is_featured
          )
        `)
        .eq('temp_seller_id', sellerData.temp_seller_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allProperties = properties || [];

      // Calculate date threshold for "recently added" (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Calculate statistics
      const draftCount = allProperties.filter(p => p.status === 'draft').length;
      const publishedCount = allProperties.filter(p => p.status === 'active').length; // wholesale_deals uses 'active' instead of 'published'
      const archivedCount = allProperties.filter(p => p.status === 'archived').length;

      // Count by property_status if exists, otherwise use status field
      const availableCount = allProperties.filter(p =>
        (p.property_status === 'available' || (!p.property_status && p.status === 'active')) &&
        p.status !== 'archived'
      ).length;
      const soldCount = allProperties.filter(p => p.property_status === 'sold').length;
      const underContractCount = allProperties.filter(p => p.property_status === 'under_contract').length;
      const pendingCount = allProperties.filter(p => p.property_status === 'pending').length;

      const totalValue = allProperties
        .filter(p => p.status !== 'archived')
        .reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);

      const avgPrice = allProperties.filter(p => p.status !== 'archived' && p.price).length > 0
        ? totalValue / allProperties.filter(p => p.status !== 'archived' && p.price).length
        : 0;

      const totalBeds = allProperties
        .filter(p => p.status !== 'archived')
        .reduce((sum, p) => sum + (parseInt(p.bedrooms) || 0), 0);

      const totalBaths = allProperties
        .filter(p => p.status !== 'archived')
        .reduce((sum, p) => sum + (parseFloat(p.bathrooms) || 0), 0);

      const recentCount = allProperties.filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt >= sevenDaysAgo;
      }).length;

      setStats({
        totalProperties: allProperties.filter(p => p.status !== 'archived').length,
        draftProperties: draftCount,
        publishedProperties: publishedCount,
        archivedProperties: archivedCount,
        availableProperties: availableCount,
        soldProperties: soldCount,
        underContractProperties: underContractCount,
        totalValue,
        averagePrice: avgPrice,
        totalBedrooms: totalBeds,
        totalBathrooms: totalBaths,
        recentlyAdded: recentCount
      });

      // Set recent properties (top 5)
      setRecentProperties(allProperties.slice(0, 5));

      // Create recent activities
      const activities = allProperties.slice(0, 6).map(property => {
        const createdAt = new Date(property.created_at);
        const now = new Date();
        const diffMs = now - createdAt;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo;
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
        else timeAgo = `${diffMins}m ago`;

        return {
          id: property.id,
          type: property.status === 'published' ? 'published' : 'draft',
          title: property.slug?.replace(/-/g, ' ').replace(/\d+$/, '').trim() || 'Property',
          address: property.address || 'No address',
          price: `${currency}${parseFloat(property.price || 0).toLocaleString()}`,
          time: timeAgo
        };
      });
      setRecentActivities(activities);

      // Property status breakdown - show all statuses
      const statusData = [
        { name: 'Available', count: availableCount, color: 'bg-green-500' },
        { name: 'Sold Out', count: soldCount, color: 'bg-pink-500' },
        { name: 'Pending', count: pendingCount, color: 'bg-blue-500' },
        { name: 'Under Contract', count: underContractCount, color: 'bg-purple-500' }
      ];

      const totalActive = availableCount + soldCount + underContractCount + pendingCount;
      setStatusBreakdown(statusData.map(item => ({
        ...item,
        percentage: totalActive > 0 ? Math.round((item.count / totalActive) * 100) : 0
      })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };


  return (
    <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Welcome back, {user?.full_name || user?.name || 'Seller'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Here's an overview of your property portfolio
            </p>
          </div>
          <button className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
            </svg>
            <span className="text-xs font-medium text-gray-700">Select Dates</span>
          </button>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Draft Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Draft Properties</span>
            </div>
            {loading ? (
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{stats.draftProperties}</p>
            )}
          </motion.div>

          {/* Sold Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Sold Properties</span>
            </div>
            {loading ? (
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{stats.soldProperties}</p>
            )}
          </motion.div>

          {/* Under Contract */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Under Contract</span>
            </div>
            {loading ? (
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{stats.underContractProperties}</p>
            )}
          </motion.div>

          {/* Average Price */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Average Price</span>
            </div>
            {loading ? (
              <div className="h-6 w-16 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{currency}{Math.round(stats.averagePrice).toLocaleString()}</p>
            )}
          </motion.div>

          {/* Total Bedrooms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Total Bedrooms</span>
            </div>
            {loading ? (
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{stats.totalBedrooms}</p>
            )}
          </motion.div>

          {/* Recently Added */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-card-hover transition-shadow"
          >
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">Recently Added</span>
            </div>
            {loading ? (
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-semibold text-gray-900">{stats.recentlyAdded}</p>
            )}
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card"
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Recent Properties</h2>
              <Link
                href="/properties"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                View All →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Prop. Status</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded"></div></td>
                        <td className="px-4 py-3"><div className="h-3 w-14 bg-gray-100 rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : recentProperties.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center">
                        <p className="text-sm text-gray-500">No properties yet</p>
                      </td>
                    </tr>
                  ) : (
                    recentProperties.map((property) => {
                      // Get featured image or first image
                      const featuredImage = property.property_photos?.find(p => p.is_featured);
                      const sortedImages = property.property_photos?.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                      const firstImage = featuredImage?.photo_url || sortedImages?.[0]?.photo_url;
                      const propertyType = property.property_type || 'Villa';

                      return (
                        <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {firstImage && (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                  <img src={firstImage} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-gray-900 truncate max-w-[180px]">
                                  {property.full_address || property.address || 'Property'}
                                </p>
                                <p className="text-xs text-gray-500 truncate max-w-[180px]">
                                  {property.city && property.state ? `${property.city}, ${property.state}` : property.address?.split(',')[0] || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            {propertyType}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                              property.status === 'draft'
                                ? 'bg-status-draftLight text-yellow-700'
                                : property.status === 'published'
                                ? 'bg-status-availableLight text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {property.status?.charAt(0).toUpperCase() + property.status?.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                              property.property_status === 'available'
                                ? 'bg-status-availableLight text-green-700'
                                : property.property_status === 'sold'
                                ? 'bg-status-soldLight text-red-700'
                                : property.property_status === 'under_contract'
                                ? 'bg-status-contractLight text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {property.property_status?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-900 text-right">
                            {currency}{parseFloat(property.price || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card"
          >
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Recent Activities</h2>
            </div>

            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto scrollbar-hide">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No recent activities</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {activity.type === 'published' ? 'Added a new property' : 'Edited a property'}{' '}
                        <Link href={`/properties`} className="text-blue-600 hover:underline">
                          {activity.title}
                        </Link>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200">
              <Link
                href="/properties"
                className="block text-center text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                View All →
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Bottom Grid - Three Equal Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Property Status Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card"
          >
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Property Status Breakdown</h2>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="w-40 h-40 bg-gray-100 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : statusBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No properties to display</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Pie Chart */}
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 100 100">
                        <g transform="rotate(-90 50 50)">
                          {(() => {
                            let currentAngle = 0;
                            return statusBreakdown.map((item, index) => {
                              const percentage = item.percentage;
                              const angle = (percentage / 100) * 360;
                              const startAngle = currentAngle;
                              currentAngle += angle;

                              const startRad = (startAngle * Math.PI) / 180;
                              const endRad = (currentAngle * Math.PI) / 180;
                              const x1 = 50 + 40 * Math.cos(startRad);
                              const y1 = 50 + 40 * Math.sin(startRad);
                              const x2 = 50 + 40 * Math.cos(endRad);
                              const y2 = 50 + 40 * Math.sin(endRad);
                              const largeArc = angle > 180 ? 1 : 0;

                              const colors = {
                                Available: '#10B981',
                                'Sold Out': '#EC4899',
                                'Pending': '#3B82F6',
                                'Under Contract': '#8B5CF6'
                              };

                              return (
                                <path
                                  key={item.name}
                                  d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                  fill={colors[item.name] || '#E5E7EB'}
                                  className="transition-all hover:opacity-80"
                                />
                              );
                            });
                          })()}
                        </g>
                        <circle cx="50" cy="50" r="25" fill="white" />
                        <text x="50" y="45" textAnchor="middle" fontSize="5" fontWeight="600" className="fill-gray-500">Total</text>
                        <text x="50" y="52" textAnchor="middle" fontSize="5" fontWeight="600" className="fill-gray-500">Properties</text>
                        <text x="50" y="62" textAnchor="middle" fontSize="10" fontWeight="700" className="fill-gray-900">{stats.totalProperties}</text>
                      </svg>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-1.5 flex-1">
                    {statusBreakdown.map((item) => {
                      const colors = {
                        Available: 'bg-green-500',
                        'Sold Out': 'bg-pink-500',
                        'Pending': 'bg-blue-500',
                        'Under Contract': 'bg-purple-500'
                      };
                      const dotColor = colors[item.name] || 'bg-gray-500';

                      return (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
                            <span className="text-xs font-medium text-gray-700">{item.name}</span>
                          </div>
                          <span className="text-xs text-gray-600">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Property Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card"
          >
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Property Summary</h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600">Total Properties</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalProperties}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-600">Total Values</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{currency}{stats.totalValue.toLocaleString()}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-600">Available</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{stats.availableProperties}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-600">Published</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{stats.publishedProperties}</p>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-card"
          >
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
            </div>

            <div className="p-4 space-y-2.5">
              <Link
                href="/properties/new"
                className="block p-3 bg-brand-red text-white hover:bg-red-600 rounded-lg transition-all text-center text-sm font-medium"
              >
                Add New Property
              </Link>

              <Link
                href="/properties"
                className="block p-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-all text-center text-sm font-medium text-gray-700"
              >
                Manage Properties
              </Link>

              <Link
                href="/properties?view=trash"
                className="block p-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-all text-center text-sm font-medium text-gray-700"
              >
                View Archived
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
  );
}
